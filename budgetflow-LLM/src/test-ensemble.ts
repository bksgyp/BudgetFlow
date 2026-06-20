// BudgetFlow 텍스트 파싱 앙상블 테스트
// Haiku + Sonnet + Gemini 세 모델 결과를 voting으로 합산
import * as XLSX from "xlsx";
import https from "https";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const CONFIG = {
  LLM_SERVER: "http://localhost:4000",
  REQUEST_DATE: "2026-05-17",
  CATEGORIES: [
    { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링"] },
    { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "삼겹살", "회식"] },
    { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통"] },
    { id: "cat_04", name: "회의비",  keywords: ["회의", "미팅", "세미나"] },
  ],
};

const TIMESTAMP   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_XLSX = `ensemble_results_${TIMESTAMP}.xlsx`;
const CATEGORIES_TEXT = CONFIG.CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");

const TEST_CASES = [
  { id: "TC-01", input: "어제 행사 다과 32,000원",        expected: { date: "2026-05-16", amount: 32000,   merchant: null,      categoryId: "cat_01", payerName: null } },
  { id: "TC-02", input: "삼겹살 158000 홍길동",           expected: { date: null,         amount: 158000,  merchant: null,      categoryId: "cat_02", payerName: "홍길동" } },
  { id: "TC-03", input: "5/12 OO마트 영수증",            expected: { date: "2026-05-12", amount: null,    merchant: "OO마트",  categoryId: null,     payerName: null } },
  { id: "TC-04", input: "회식비",                        expected: { date: null,         amount: null,    merchant: null,      categoryId: "cat_02", payerName: null } },
  { id: "TC-05", input: "2만원",                         expected: { date: null,         amount: 20000,   merchant: null,      categoryId: null,     payerName: null } },
  { id: "TC-06", input: "택시비 오만원",                  expected: { date: null,         amount: 50000,   merchant: null,      categoryId: "cat_03", payerName: null } },
  { id: "TC-07", input: "커피 회의 15000원",              expected: { date: null,         amount: 15000,   merchant: null,      categoryId: null,     payerName: null } },
  { id: "TC-08", input: "4/30 점심 식대 12000원",         expected: { date: "2026-04-30", amount: 12000,   merchant: null,      categoryId: "cat_02", payerName: null } },
  { id: "TC-09", input: "GS25 편의점 간식 8500원",        expected: { date: null,         amount: 8500,    merchant: "GS25",    categoryId: "cat_01", payerName: null } },
  { id: "TC-10", input: "2026-05-15 스타벅스 다과비 홍길동 43000원", expected: { date: "2026-05-15", amount: 43000, merchant: "스타벅스", categoryId: "cat_01", payerName: "홍길동" } },
  { id: "TC-11", input: "저번 주 화요일 세미나 간식 25000원", expected: { date: null,     amount: 25000,   merchant: null,      categoryId: "cat_01", payerName: null } },
  { id: "TC-12", input: "행사 홍보물 제작비 1,250,000원", expected: { date: null,         amount: 1250000, merchant: null,      categoryId: null,     payerName: null } },
];

const TEXT_PARSE_TOOL: Anthropic.Tool = {
  name: "extract_expense",
  description: "Extract structured expense data from Korean natural language input.",
  input_schema: {
    type: "object" as const,
    properties: {
      date:        { type: ["string", "null"], description: "YYYY-MM-DD format. null if cannot be determined." },
      amount:      { type: ["integer", "null"], description: "Integer amount in KRW. null if cannot be determined." },
      merchant:    { type: ["string", "null"], description: "Store or vendor name. null if not mentioned." },
      description: { type: "string" },
      categoryId:  { type: ["string", "null"], description: "Must match one of the provided category IDs. null if no match." },
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

function buildPrompt(text: string): string {
  return `You are a Korean expense data extraction assistant.
Extract structured expense information from the following natural language input.
Rules:
- Extract only what is explicitly stated. Do NOT guess. Use null if uncertain.
- All amounts must be integers in KRW. Remove commas.
- Relative dates: requestDate is ${CONFIG.REQUEST_DATE}. "어제"=1 day before, "그제"=2 days before. Unknown=null.
- Choose categoryId strictly from the list. If no match or tie, use null.
Available categories:
${CATEGORIES_TEXT}
Input: ${text}`;
}

async function callClaude(text: string, model: string): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model, max_tokens: 1024,
    tools: [TEXT_PARSE_TOOL],
    tool_choice: { type: "tool", name: "extract_expense" },
    messages: [{ role: "user", content: buildPrompt(text) }],
  });
  const toolUse = message.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock;
  return toolUse.input;
}

async function callGemini(text: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 없음");
  const prompt = `${buildPrompt(text)}\n\nReturn ONLY this JSON (no markdown):\n{"date":"YYYY-MM-DD or null","amount":integer or null,"merchant":"string or null","description":"string","categoryId":"string or null","payerName":"string or null","confidence":{"date":boolean,"amount":boolean,"category":boolean,"payerName":boolean}}`;
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 1024 } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) throw new Error(json.error.message);
          const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const clean = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
          resolve(JSON.parse(clean));
        } catch(e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

function vote<T>(values: (T | null)[]): T | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v === null || v === undefined) continue;
    counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best: [string, number] = ["", 0];
  for (const [k, cnt] of counts) if (cnt > best[1]) best = [k, cnt];
  if (best[1] >= 2) return values.find(v => String(v) === best[0]) ?? null;
  return null;
}

function ensemble(results: any[]): any {
  const date       = vote<string>(results.map(r => r.date       ?? null));
  const amount     = vote<number>(results.map(r => r.amount     ?? null));
  const merchant   = vote<string>(results.map(r => r.merchant   ?? null));
  const categoryId = vote<string>(results.map(r => r.categoryId ?? null));
  const payerName  = vote<string>(results.map(r => r.payerName  ?? null));
  const avgConf    = results.reduce((s,r) => {
    const c = r.confidence ?? {};
    return s + (c.date?0.3:0) + (c.amount?0.4:0) + (c.category?0.2:0) + (c.payerName?0.1:0);
  }, 0) / results.length;
  const aiConfidence = Math.min(1.0, Math.round(avgConf * 10) / 10);
  return { date, amount, merchant, categoryId, payerName, aiConfidence };
}

function compare(result: any, expected: any) {
  const d = result.date       === expected.date;
  const a = (result.amount    ?? null) === expected.amount;
  const m = (result.merchant  ?? null) === expected.merchant;
  const c = (result.categoryId?? null) === expected.categoryId;
  const p = (result.payerName ?? null) === expected.payerName;
  return { dateCorrect:d, amountCorrect:a, merchantCorrect:m, categoryCorrect:c, payerCorrect:p, allCorrect:d&&a&&m&&c&&p };
}

function saveExcel(rows: any[], summary: Record<string, any>) {
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = Object.keys(rows[0]||{}).map(k=>({wch:Math.max(k.length,12)}));
  XLSX.utils.book_append_sheet(wb, ws1, "앙상블결과");
  const ws2 = XLSX.utils.json_to_sheet(Object.entries(summary).map(([k,v])=>({지표:k,값:v})));
  ws2["!cols"] = [{wch:25},{wch:25}];
  XLSX.utils.book_append_sheet(wb, ws2, "요약");
  XLSX.writeFile(wb, OUTPUT_XLSX);
  console.log(`\n📊 엑셀 저장: ${OUTPUT_XLSX}`);
}

function buildSummary(rows: any[]) {
  const ok = rows.filter(r=>r.상태==="success");
  const pct = (n:number,d:number) => d===0?"0%":`${((n/d)*100).toFixed(1)}%`;
  return {
    "앙상블 모델": "Haiku + Sonnet + Gemini (voting)",
    "총 TC 수": rows.length,
    "전체 정확도": pct(ok.filter(r=>r.전체일치==="Y").length,ok.length),
    "날짜 정확도": pct(ok.filter(r=>r.날짜일치==="Y").length,ok.length),
    "금액 정확도": pct(ok.filter(r=>r.금액일치==="Y").length,ok.length),
    "상호명 정확도": pct(ok.filter(r=>r.상호명일치==="Y").length,ok.length),
    "카테고리 정확도": pct(ok.filter(r=>r.카테고리일치==="Y").length,ok.length),
    "결제자 정확도": pct(ok.filter(r=>r.결제자일치==="Y").length,ok.length),
    "평균 신뢰도": ok.length>0?(ok.reduce((s,r)=>s+r.신뢰도,0)/ok.length).toFixed(3):"N/A",
    "평균 응답 시간": ok.length>0?`${Math.round(ok.reduce((s,r)=>s+r.응답시간ms,0)/ok.length)}ms`:"N/A",
    "테스트 일시": TIMESTAMP,
  };
}

async function main() {
  console.log(`\n[앙상블 테스트] Haiku + Sonnet + Gemini | TC: ${TEST_CASES.length}개\n`);
  const rows: any[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}] "${tc.input}"\n  → `);
    const row: any = {
      TC: tc.id, 입력: tc.input, 상태: "success",
      날짜추출:"null", 날짜정답:String(tc.expected.date), 날짜일치:"N",
      금액추출:"null", 금액정답:String(tc.expected.amount), 금액일치:"N",
      상호명추출:"null", 상호명정답:String(tc.expected.merchant), 상호명일치:"N",
      카테고리추출:"null", 카테고리정답:String(tc.expected.categoryId), 카테고리일치:"N",
      결제자추출:"null", 결제자정답:String(tc.expected.payerName), 결제자일치:"N",
      전체일치:"N", 신뢰도:0, 응답시간ms:0,
      haiku결과:"", sonnet결과:"", gemini결과:"", 오류:"",
    };

    try {
      const t0 = Date.now();
      const [haikuRes, sonnetRes, geminiRes] = await Promise.allSettled([
        callClaude(tc.input, "claude-haiku-4-5-20251001"),
        callClaude(tc.input, "claude-sonnet-4-5-20250929"),
        callGemini(tc.input),
      ]);
      row.응답시간ms = Date.now() - t0;

      const results: any[] = [];
      if (haikuRes.status  === "fulfilled") { results.push(haikuRes.value);  row.haiku결과  = `date=${haikuRes.value.date}  amount=${haikuRes.value.amount}  cat=${haikuRes.value.categoryId}`; }
      else row.haiku결과  = `❌ ${haikuRes.reason?.message}`;
      if (sonnetRes.status === "fulfilled") { results.push(sonnetRes.value); row.sonnet결과 = `date=${sonnetRes.value.date} amount=${sonnetRes.value.amount} cat=${sonnetRes.value.categoryId}`; }
      else row.sonnet결과 = `❌ ${sonnetRes.reason?.message}`;
      if (geminiRes.status === "fulfilled") { results.push(geminiRes.value); row.gemini결과 = `date=${geminiRes.value.date} amount=${geminiRes.value.amount} cat=${geminiRes.value.categoryId}`; }
      else row.gemini결과 = `❌ ${geminiRes.reason?.message}`;

      if (results.length === 0) throw new Error("모든 모델 실패");

      const ensembled = ensemble(results);
      row.날짜추출     = String(ensembled.date       ?? "null");
      row.금액추출     = String(ensembled.amount      ?? "null");
      row.상호명추출   = String(ensembled.merchant    ?? "null");
      row.카테고리추출 = String(ensembled.categoryId  ?? "null");
      row.결제자추출   = String(ensembled.payerName   ?? "null");
      row.신뢰도       = ensembled.aiConfidence;

      const cmp = compare(ensembled, tc.expected);
      row.날짜일치     = cmp.dateCorrect     ? "Y" : "N";
      row.금액일치     = cmp.amountCorrect   ? "Y" : "N";
      row.상호명일치   = cmp.merchantCorrect ? "Y" : "N";
      row.카테고리일치 = cmp.categoryCorrect ? "Y" : "N";
      row.결제자일치   = cmp.payerCorrect    ? "Y" : "N";
      row.전체일치     = cmp.allCorrect      ? "Y" : "N";

      console.log(`${cmp.allCorrect?"✅":"⚠️"} ${row.응답시간ms}ms | 전체=${row.전체일치} | 날짜=${row.날짜일치} 금액=${row.금액일치} 카테=${row.카테고리일치}`);
      console.log(`     Haiku:  ${row.haiku결과}`);
      console.log(`     Sonnet: ${row.sonnet결과}`);
      console.log(`     Gemini: ${row.gemini결과}`);
      console.log(`     투표:   date=${row.날짜추출} amount=${row.금액추출} cat=${row.카테고리추출}`);

    } catch(e: any) {
      row.상태 = "error"; row.오류 = e.message;
      console.log(`❌ ${e.message}`);
    }

    rows.push(row);
    await new Promise(r => setTimeout(r, 500));
  }

  const summary = buildSummary(rows);
  console.log("\n========== 앙상블 결과 요약 ==========");
  Object.entries(summary).forEach(([k,v]) => console.log(`${k.padEnd(20)}: ${v}`));
  console.log("=======================================");
  saveExcel(rows, summary);
}

main().catch(console.error);
