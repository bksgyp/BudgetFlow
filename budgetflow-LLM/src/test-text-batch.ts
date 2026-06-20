// BudgetFlow 텍스트 파싱 배치 테스트 — 멀티모델 벤치마킹
// Claude Haiku, Sonnet, Gemini, DeepSeek 비교
import * as XLSX from "xlsx";
import https from "https";
import dotenv from "dotenv";
dotenv.config();

const TEST_MODEL      = process.env.TEST_MODEL ?? "haiku";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
const MODEL_LABEL     = TEST_MODEL === "gemini" ? "gemini"
  : TEST_MODEL === "deepseek" ? "deepseek"
  : ANTHROPIC_MODEL.includes("sonnet") ? "sonnet" : "haiku";

const CONFIG = {
  LLM_SERVER: "http://localhost:4000",
  REQUEST_DATE: "2026-05-17",
  TIMEZONE: "Asia/Seoul",
  SUBMITTED_BY: { userId: "U12345", displayName: "진수연" },
  CATEGORIES: [
    { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링"] },
    { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "삼겹살", "회식"] },
    { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통"] },
    { id: "cat_04", name: "회의비",  keywords: ["회의", "미팅", "세미나"] },
  ],
  DELAY_MS: 1000,
};

const TIMESTAMP   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_XLSX = `text_results_${MODEL_LABEL}_${TIMESTAMP}.xlsx`;

const TEST_CASES = [
  { id: "TC-01", input: "어제 행사 다과 32,000원",
    expected: { date: "2026-05-16", amount: 32000, merchant: null, categoryId: "cat_01", payerName: null } },
  { id: "TC-02", input: "삼겹살 158000 홍길동",
    expected: { date: null, amount: 158000, merchant: null, categoryId: "cat_02", payerName: "홍길동" } },
  { id: "TC-03", input: "5/12 OO마트 영수증",
    expected: { date: "2026-05-12", amount: null, merchant: "OO마트", categoryId: null, payerName: null } },
  { id: "TC-04", input: "회식비",
    expected: { date: null, amount: null, merchant: null, categoryId: "cat_02", payerName: null } },
  { id: "TC-05", input: "2만원",
    expected: { date: null, amount: 20000, merchant: null, categoryId: null, payerName: null } },
  { id: "TC-06", input: "택시비 오만원",
    expected: { date: null, amount: 50000, merchant: null, categoryId: "cat_03", payerName: null } },
  { id: "TC-07", input: "커피 회의 15000원",
    expected: { date: null, amount: 15000, merchant: null, categoryId: null, payerName: null } },
  { id: "TC-08", input: "4/30 점심 식대 12000원",
    expected: { date: "2026-04-30", amount: 12000, merchant: null, categoryId: "cat_02", payerName: null } },
  { id: "TC-09", input: "GS25 편의점 간식 8500원",
    expected: { date: null, amount: 8500, merchant: "GS25", categoryId: "cat_01", payerName: null } },
  { id: "TC-10", input: "2026-05-15 스타벅스 다과비 홍길동 43000원",
    expected: { date: "2026-05-15", amount: 43000, merchant: "스타벅스", categoryId: "cat_01", payerName: "홍길동" } },
  { id: "TC-11", input: "저번 주 화요일 세미나 간식 25000원",
    expected: { date: null, amount: 25000, merchant: null, categoryId: "cat_01", payerName: null } },
  { id: "TC-12", input: "행사 홍보물 제작비 1,250,000원",
    expected: { date: null, amount: 1250000, merchant: null, categoryId: null, payerName: null } },
];

const CATEGORIES_TEXT = CONFIG.CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");

function buildPrompt(text: string, requestDate: string): string {
  return `You are a Korean expense data extraction assistant.
Extract structured expense information from the following natural language input.
Rules:
- Extract only what is explicitly stated. Do NOT guess. Use null if uncertain.
- All amounts must be integers in KRW. Remove commas.
- Relative dates: requestDate is ${requestDate}. "어제"=1 day before, "그제"=2 days before. Unknown=null.
- Choose categoryId strictly from the list. If no match or tie, use null.
Available categories:
${CATEGORIES_TEXT}
Return ONLY this JSON (no markdown):
{"date":"YYYY-MM-DD or null","amount":integer or null,"merchant":"string or null","description":"string","categoryId":"string or null","payerName":"string or null","confidence":{"date":boolean,"amount":boolean,"category":boolean,"payerName":boolean}}
Input: ${text}`;
}

function parseJsonResponse(text: string): any {
  const clean = text.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
  return JSON.parse(clean);
}

async function callClaudeServer(text: string) {
  const res = await fetch(`${CONFIG.LLM_SERVER}/analyze/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputType: "text", text, projectId: "test_batch",
      requestDate: CONFIG.REQUEST_DATE, timezone: CONFIG.TIMEZONE,
      submittedBy: CONFIG.SUBMITTED_BY, categories: CONFIG.CATEGORIES,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

async function callExternalText(text: string, model: "gemini" | "deepseek"): Promise<any> {
  const prompt = buildPrompt(text, CONFIG.REQUEST_DATE);

  if (model === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY 없음");
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 1024 },
    });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    return new Promise((resolve, reject) => {
      const req = https.request(url, { method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.error) throw new Error(json.error.message);
            resolve(parseJsonResponse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? ""));
          } catch(e) { reject(e); }
        });
        res.on("error", reject);
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  } else {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY 없음");
    const body = JSON.stringify({
      model: "deepseek-chat", max_tokens: 1024, temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    return new Promise((resolve, reject) => {
      const req = https.request("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.error) throw new Error(json.error.message);
            resolve(parseJsonResponse(json.choices?.[0]?.message?.content ?? ""));
          } catch(e) { reject(e); }
        });
        res.on("error", reject);
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}

function calcConfidence(c: any) {
  return Math.round(((c.date?0.3:0)+(c.amount?0.4:0)+(c.category?0.2:0)+(c.payerName?0.1:0))*10)/10;
}

function compare(result: any, expected: any) {
  const actualAmount = result.action === "request_re_input" ? null : (result.amount ?? null);
  const d = result.date === expected.date;
  const a = actualAmount === expected.amount;
  const m = (result.merchant ?? null) === expected.merchant;
  const c = (result.categoryId ?? null) === expected.categoryId;
  const p = (result.payerName ?? null) === expected.payerName;
  return { dateCorrect:d, amountCorrect:a, merchantCorrect:m, categoryCorrect:c, payerCorrect:p, allCorrect:d&&a&&m&&c&&p };
}

function saveExcel(rows: any[], summary: Record<string, any>) {
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = Object.keys(rows[0]||{}).map(k=>({wch:Math.max(k.length,12)}));
  XLSX.utils.book_append_sheet(wb, ws1, "상세결과");
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
    "테스트 모델": MODEL_LABEL, "총 TC 수": rows.length,
    "API 성공": `${ok.length}개 (${pct(ok.length,rows.length)})`,
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
  console.log(`\n[텍스트 파싱 배치 테스트] 모델: ${MODEL_LABEL} | TC: ${TEST_CASES.length}개\n`);
  const rows: any[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}] "${tc.input}" → `);
    const row: any = {
      TC: tc.id, 모델: MODEL_LABEL, 입력: tc.input, 상태: "success",
      날짜추출: "null", 날짜정답: String(tc.expected.date), 날짜일치: "N",
      금액추출: "null", 금액정답: String(tc.expected.amount), 금액일치: "N",
      상호명추출: "null", 상호명정답: String(tc.expected.merchant), 상호명일치: "N",
      카테고리추출: "null", 카테고리정답: String(tc.expected.categoryId), 카테고리일치: "N",
      결제자추출: "null", 결제자정답: String(tc.expected.payerName), 결제자일치: "N",
      전체일치: "N", 신뢰도: 0, 검토필요: "N", 응답시간ms: 0, 오류: "",
    };

    try {
      const t0 = Date.now();
      let result: any;

      if (TEST_MODEL === "gemini" || TEST_MODEL === "deepseek") {
        result = await callExternalText(tc.input, TEST_MODEL as "gemini"|"deepseek");
        result.aiConfidence = calcConfidence(result.confidence ?? {});
        result.needsReview = result.aiConfidence < 0.7;
      } else {
        result = await callClaudeServer(tc.input);
      }

      row.응답시간ms = Date.now() - t0;
      const actualAmount = result.action === "request_re_input" ? null : (result.amount ?? null);
      row.날짜추출     = String(result.date      ?? "null");
      row.금액추출     = String(actualAmount      ?? "null");
      row.상호명추출   = String(result.merchant   ?? "null");
      row.카테고리추출 = String(result.categoryId ?? "null");
      row.결제자추출   = String(result.payerName  ?? "null");
      row.신뢰도       = result.aiConfidence      ?? 0;
      row.검토필요     = result.needsReview ? "Y" : "N";

      const cmp = compare(result, tc.expected);
      row.날짜일치     = cmp.dateCorrect     ? "Y" : "N";
      row.금액일치     = cmp.amountCorrect   ? "Y" : "N";
      row.상호명일치   = cmp.merchantCorrect ? "Y" : "N";
      row.카테고리일치 = cmp.categoryCorrect ? "Y" : "N";
      row.결제자일치   = cmp.payerCorrect    ? "Y" : "N";
      row.전체일치     = cmp.allCorrect      ? "Y" : "N";

      console.log(`${cmp.allCorrect?"✅":"⚠️"} ${row.응답시간ms}ms | 전체=${row.전체일치} | 날짜=${row.날짜일치} 금액=${row.금액일치} 카테=${row.카테고리일치}`);
    } catch(e: any) {
      row.상태 = "error"; row.오류 = e.message;
      console.log(`❌ ${e.message}`);
    }

    rows.push(row);
    await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
  }

  const summary = buildSummary(rows);
  console.log("\n========== 결과 요약 ==========");
  Object.entries(summary).forEach(([k,v]) => console.log(`${k.padEnd(20)}: ${v}`));
  console.log("================================");
  saveExcel(rows, summary);
}

main().catch(console.error);
