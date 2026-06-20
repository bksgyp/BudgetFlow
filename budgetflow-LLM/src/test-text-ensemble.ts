// BudgetFlow 텍스트 파싱 앙상블 테스트 — Haiku + Sonnet + Gemini 투표
// test-text-batch.ts(수정판)와 동일한 프로덕션 프롬프트/직접 API 호출 재사용

import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import https from "https";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const REQUEST_DATE = "2026-05-17";
const TIMEZONE = "Asia/Seoul";
const SUBMITTED_BY = { userId: "U12345", displayName: "진수연" };
const CATEGORIES = [
  { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링"] },
  { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "삼겹살", "회식"] },
  { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통"] },
  { id: "cat_04", name: "회의비",  keywords: ["회의", "미팅", "세미나"] },
];
const CATEGORIES_TEXT = CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");

const TEST_CASES = [
  { id: "TC-01", input: "어제 행사 다과 32,000원", expected: { date: "2026-05-16", amount: 32000, merchant: null, categoryId: "cat_01", payerName: null } },
  { id: "TC-02", input: "삼겹살 158000 홍길동", expected: { date: null, amount: 158000, merchant: null, categoryId: "cat_02", payerName: "홍길동" } },
  { id: "TC-03", input: "5/12 OO마트 영수증", expected: { date: "2026-05-12", amount: null, merchant: "OO마트", categoryId: null, payerName: null } },
  { id: "TC-04", input: "회식비", expected: { date: null, amount: null, merchant: null, categoryId: "cat_02", payerName: null } },
  { id: "TC-05", input: "2만원", expected: { date: null, amount: 20000, merchant: null, categoryId: null, payerName: null } },
  { id: "TC-06", input: "택시비 오만원", expected: { date: null, amount: 50000, merchant: null, categoryId: "cat_03", payerName: null } },
  { id: "TC-07", input: "커피 회의 15000원", expected: { date: null, amount: 15000, merchant: null, categoryId: null, payerName: null } },
  { id: "TC-08", input: "4/30 점심 식대 12000원", expected: { date: "2026-04-30", amount: 12000, merchant: null, categoryId: "cat_02", payerName: null } },
  { id: "TC-09", input: "GS25 편의점 간식 8500원", expected: { date: null, amount: 8500, merchant: "GS25", categoryId: "cat_01", payerName: null } },
  { id: "TC-10", input: "2026-05-15 스타벅스 다과비 홍길동 43000원", expected: { date: "2026-05-15", amount: 43000, merchant: "스타벅스", categoryId: "cat_01", payerName: "홍길동" } },
  { id: "TC-11", input: "저번 주 화요일 세미나 간식 25000원", expected: { date: null, amount: 25000, merchant: null, categoryId: "cat_01", payerName: null } },
  { id: "TC-12", input: "행사 홍보물 제작비 1,250,000원", expected: { date: null, amount: 1250000, merchant: null, categoryId: null, payerName: null } },
];

const TEXT_PROMPT_TEMPLATE = fs.readFileSync(path.resolve(__dirname, "../prompts/text_parse_prompt.txt"), "utf-8");
function buildProdPrompt(text: string): string {
  return TEXT_PROMPT_TEMPLATE
    .replaceAll("{{requestDate}}", REQUEST_DATE)
    .replaceAll("{{timezone}}", TIMEZONE)
    .replaceAll("{{submittedBy.displayName}}", SUBMITTED_BY.displayName)
    .replaceAll("{{submittedBy.userId}}", SUBMITTED_BY.userId)
    .replaceAll("{{categories}}", CATEGORIES_TEXT)
    .replaceAll("{{text}}", text);
}

const JSON_SUFFIX = `

Return ONLY this JSON (no markdown, no explanation):
{"date":"YYYY-MM-DD or null","amount":integer or null,"merchant":"string or null","description":"string","categoryId":"string or null","payerName":"string or null","confidence":{"date":boolean,"amount":boolean,"category":boolean,"payerName":boolean}}`;

const TEXT_PARSE_TOOL: Anthropic.Tool = {
  name: "extract_expense",
  description: "Extract structured expense data from Korean natural language input.",
  input_schema: {
    type: "object" as const,
    properties: {
      date:        { type: ["string", "null"] }, amount: { type: ["integer", "null"] },
      merchant:    { type: ["string", "null"] }, description: { type: "string" },
      categoryId:  { type: ["string", "null"] }, payerName: { type: ["string", "null"] },
      confidence: {
        type: "object",
        properties: { date:{type:"boolean"}, amount:{type:"boolean"}, category:{type:"boolean"}, payerName:{type:"boolean"} },
        required: ["date","amount","category","payerName"],
      },
    },
    required: ["date","amount","merchant","description","categoryId","payerName","confidence"],
  },
};

async function callClaudeDirect(model: string, text: string): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model, max_tokens: 1024,
    tools: [TEXT_PARSE_TOOL], tool_choice: { type: "tool", name: "extract_expense" },
    messages: [{ role: "user", content: buildProdPrompt(text) }],
  });
  const toolUse = message.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!toolUse) throw new Error("Tool Use 응답 없음");
  return toolUse.input as any;
}

function parseJsonSafe(text: string): any {
  const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

async function callGeminiDirect(text: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 없음");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: buildProdPrompt(text) + JSON_SUFFIX }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 1024 },
  });
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) throw new Error(json.error.message);
          resolve(parseJsonSafe(json.candidates?.[0]?.content?.parts?.[0]?.text ?? ""));
        } catch(e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

function vote(a: any, b: any, c: any): { value: any; agreement: number } {
  const vals = [a, b, c];
  const counts = new Map<string, { value: any; count: number }>();
  for (const v of vals) {
    const key = JSON.stringify(v);
    if (!counts.has(key)) counts.set(key, { value: v, count: 0 });
    counts.get(key)!.count++;
  }
  let best = { value: null as any, count: 0 };
  for (const e of counts.values()) if (e.count > best.count) best = e;
  return { value: best.count >= 2 ? best.value : null, agreement: best.count };
}

function isMatch(actual: any, expected: any): boolean {
  if (expected === null) return actual === null || actual === undefined;
  return actual === expected;
}

async function main() {
  console.log("\n[텍스트 앙상블] Haiku + Sonnet + Gemini 투표, 12개 케이스\n");
  const rows: any[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}] `);
    const row: any = { 케이스: tc.id, 입력: tc.input };
    try {
      const [h, s, g] = await Promise.allSettled([
        callClaudeDirect("claude-haiku-4-5-20251001", tc.input),
        callClaudeDirect("claude-sonnet-4-5-20250929", tc.input),
        callGeminiDirect(tc.input),
      ]);
      const haiku  = h.status === "fulfilled" ? h.value : null;
      const sonnet = s.status === "fulfilled" ? s.value : null;
      const gemini = g.status === "fulfilled" ? g.value : null;

      const vd = vote(haiku?.date ?? null, sonnet?.date ?? null, gemini?.date ?? null);
      const va = vote(haiku?.amount ?? null, sonnet?.amount ?? null, gemini?.amount ?? null);
      const vm = vote(haiku?.merchant ?? null, sonnet?.merchant ?? null, gemini?.merchant ?? null);
      const vc = vote(haiku?.categoryId ?? null, sonnet?.categoryId ?? null, gemini?.categoryId ?? null);
      const vp = vote(haiku?.payerName ?? null, sonnet?.payerName ?? null, gemini?.payerName ?? null);

      row.날짜_앙상블 = String(vd.value); row.날짜_일치도 = vd.agreement; row.날짜_정답 = isMatch(vd.value, tc.expected.date) ? "Y" : "N";
      row.금액_앙상블 = String(va.value); row.금액_일치도 = va.agreement; row.금액_정답 = isMatch(va.value, tc.expected.amount) ? "Y" : "N";
      row.상호명_앙상블 = String(vm.value); row.상호명_일치도 = vm.agreement; row.상호명_정답 = isMatch(vm.value, tc.expected.merchant) ? "Y" : "N";
      row.카테고리_앙상블 = String(vc.value); row.카테고리_일치도 = vc.agreement; row.카테고리_정답 = isMatch(vc.value, tc.expected.categoryId) ? "Y" : "N";
      row.결제자_앙상블 = String(vp.value); row.결제자_일치도 = vp.agreement; row.결제자_정답 = isMatch(vp.value, tc.expected.payerName) ? "Y" : "N";
      row.전체일치 = [row.날짜_정답, row.금액_정답, row.상호명_정답, row.카테고리_정답, row.결제자_정답].every(v=>v==="Y") ? "Y" : "N";

      console.log(`${row.전체일치==="Y"?"✅":"⚠️"} 날짜=${row.날짜_앙상블}(${vd.agreement}) 금액=${row.금액_앙상블}(${va.agreement})`);
    } catch(e: any) {
      row.전체일치 = "N"; row.오류 = e.message;
      console.log(`❌ ${e.message}`);
    }
    rows.push(row);
    await new Promise(r => setTimeout(r, 800));
  }

  const pct = (field: string) => `${((rows.filter(r=>r[field]==="Y").length/rows.length)*100).toFixed(1)}%`;
  const summary = {
    전체정확도: pct("전체일치"), 날짜정확도: pct("날짜_정답"), 금액정확도: pct("금액_정답"),
    상호명정확도: pct("상호명_정답"), 카테고리정확도: pct("카테고리_정답"), 결제자정확도: pct("결제자_정답"),
  };
  console.log("\n========== 텍스트 앙상블 요약 ==========");
  console.log(JSON.stringify(summary, null, 2));
  console.log("==========================================");

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "상세결과");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `text_ensemble_results_${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log(`📊 엑셀 저장: ${filename}`);
}

main().catch(console.error);
