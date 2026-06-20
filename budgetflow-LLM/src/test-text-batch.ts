// BudgetFlow 텍스트 파싱 배치 테스트 — 멀티모델 벤치마킹 (수정판)
// 기존 버전은 Haiku/Sonnet 호출 시 Express 서버를 거쳐 모델이 고정되는 버그가 있었고,
// 프롬프트도 구버전("Return ONLY JSON")을 스크립트에 하드코딩해서 썼음.
// → 실제 프로덕션 프롬프트(text_parse_prompt.txt) + Tool Use(Claude) / JSON 모드(Gemini)로 수정.
//
// 실행: npx tsx src/test-text-batch.ts  (모든 모델 순차 실행, 4종 다 한 번에 비교)

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

// 실제 프로덕션 프롬프트 파일을 그대로 읽어서 사용
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

// Gemini/DeepSeek은 Tool Use가 없어서 출력 형식 안내를 별도로 덧붙임 (Claude는 Tool Use로 강제)
const JSON_SUFFIX = `

Return ONLY this JSON (no markdown, no explanation):
{"date":"YYYY-MM-DD or null","amount":integer or null,"merchant":"string or null","description":"string","categoryId":"string or null","payerName":"string or null","confidence":{"date":boolean,"amount":boolean,"category":boolean,"payerName":boolean}}`;

// bedrockClient.ts의 TEXT_PARSE_TOOL과 동일한 스키마
const TEXT_PARSE_TOOL: Anthropic.Tool = {
  name: "extract_expense",
  description: "Extract structured expense data from Korean natural language input.",
  input_schema: {
    type: "object" as const,
    properties: {
      date:        { type: ["string", "null"], description: "YYYY-MM-DD format. null if cannot be determined." },
      amount:      { type: ["integer", "null"], description: "Integer amount in KRW. null if cannot be determined." },
      merchant:    { type: ["string", "null"], description: "Store or vendor name. null if not mentioned." },
      description: { type: "string", description: "Brief summary of the expense." },
      categoryId:  { type: ["string", "null"], description: "Must match one of the provided category IDs exactly. null if no match." },
      payerName:   { type: ["string", "null"], description: "Person who paid. null if not mentioned." },
      confidence: {
        type: "object",
        properties: {
          date: { type: "boolean" }, amount: { type: "boolean" },
          category: { type: "boolean" }, payerName: { type: "boolean" },
        },
        required: ["date", "amount", "category", "payerName"],
      },
    },
    required: ["date", "amount", "merchant", "description", "categoryId", "payerName", "confidence"],
  },
};

async function callClaudeDirect(model: string, text: string): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model, max_tokens: 1024,
    tools: [TEXT_PARSE_TOOL],
    tool_choice: { type: "tool", name: "extract_expense" },
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

async function callDeepSeekDirect(text: string): Promise<any> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 없음");
  const body = JSON.stringify({
    model: "deepseek-chat", max_tokens: 1024, temperature: 0,
    messages: [{ role: "user", content: buildProdPrompt(text) + JSON_SUFFIX }],
  });
  return new Promise((resolve, reject) => {
    const req = https.request("https://api.deepseek.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) throw new Error(json.error.message);
          resolve(parseJsonSafe(json.choices?.[0]?.message?.content ?? ""));
        } catch(e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

function isMatch(actual: any, expected: any): boolean {
  if (expected === null) return actual === null || actual === undefined;
  return actual === expected;
}

async function runModel(label: string, callFn: (text: string) => Promise<any>) {
  console.log(`\n--- ${label} ---`);
  const rows: any[] = [];
  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}] `);
    const row: any = { 케이스: tc.id, 입력: tc.input, 상태: "success", 오류: "" };
    try {
      const t0 = Date.now();
      const r = await callFn(tc.input);
      row.응답시간ms = Date.now() - t0;
      row.날짜_예상 = String(tc.expected.date); row.날짜_실제 = String(r.date ?? null); row.날짜_일치 = isMatch(r.date ?? null, tc.expected.date) ? "Y" : "N";
      row.금액_예상 = String(tc.expected.amount); row.금액_실제 = String(r.amount ?? null); row.금액_일치 = isMatch(r.amount ?? null, tc.expected.amount) ? "Y" : "N";
      row.상호명_예상 = String(tc.expected.merchant); row.상호명_실제 = String(r.merchant ?? null); row.상호명_일치 = isMatch(r.merchant ?? null, tc.expected.merchant) ? "Y" : "N";
      row.카테고리_예상 = String(tc.expected.categoryId); row.카테고리_실제 = String(r.categoryId ?? null); row.카테고리_일치 = isMatch(r.categoryId ?? null, tc.expected.categoryId) ? "Y" : "N";
      row.결제자_예상 = String(tc.expected.payerName); row.결제자_실제 = String(r.payerName ?? null); row.결제자_일치 = isMatch(r.payerName ?? null, tc.expected.payerName) ? "Y" : "N";
      const allMatch = [row.날짜_일치, row.금액_일치, row.상호명_일치, row.카테고리_일치, row.결제자_일치].every(v => v === "Y");
      row.전체일치 = allMatch ? "Y" : "N";
      console.log(`${allMatch ? "✅" : "⚠️"} ${row.응답시간ms}ms`);
    } catch(e: any) {
      row.상태 = "error"; row.오류 = e.message; row.전체일치 = "N";
      console.log(`❌ ${e.message}`);
    }
    rows.push(row);
    await new Promise(r => setTimeout(r, 800));
  }
  const ok = rows.filter(r => r.상태 === "success");
  const pct = (field: string) => ok.length ? `${((ok.filter(r=>r[field]==="Y").length/ok.length)*100).toFixed(1)}%` : "N/A";
  const summary = {
    모델: label, 총케이스: TEST_CASES.length, 성공: ok.length,
    전체정확도: pct("전체일치"), 날짜정확도: pct("날짜_일치"), 금액정확도: pct("금액_일치"),
    상호명정확도: pct("상호명_일치"), 카테고리정확도: pct("카테고리_일치"), 결제자정확도: pct("결제자_일치"),
    평균응답시간: ok.length ? `${Math.round(ok.reduce((s,r)=>s+r.응답시간ms,0)/ok.length)}ms` : "N/A",
  };
  console.log(JSON.stringify(summary));
  return { rows, summary };
}

async function main() {
  const results: any[] = [];
  results.push(await runModel("haiku",    (t) => callClaudeDirect("claude-haiku-4-5-20251001", t)));
  results.push(await runModel("sonnet",   (t) => callClaudeDirect("claude-sonnet-4-5-20250929", t)));
  results.push(await runModel("gemini",   callGeminiDirect));
  results.push(await runModel("deepseek", callDeepSeekDirect));

  console.log("\n========== 4개 모델 비교 요약 ==========");
  results.forEach(r => console.log(JSON.stringify(r.summary)));
  console.log("==========================================");

  const wb = XLSX.utils.book_new();
  results.forEach(r => {
    const ws = XLSX.utils.json_to_sheet(r.rows);
    ws["!cols"] = Object.keys(r.rows[0]||{}).map(k=>({wch:Math.max(k.length,12)}));
    XLSX.utils.book_append_sheet(wb, ws, r.summary.모델);
  });
  const summaryWs = XLSX.utils.json_to_sheet(results.map(r => r.summary));
  XLSX.utils.book_append_sheet(wb, summaryWs, "요약비교");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `text_results_corrected_${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log(`\n📊 엑셀 저장: ${filename}`);
}

main().catch(console.error);
