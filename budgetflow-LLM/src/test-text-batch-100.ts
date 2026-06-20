// BudgetFlow 텍스트 파싱 100개 검증 — 최종 모델(Sonnet) 단독, 템플릿 자동 생성
// 날짜/금액/카테고리 표현을 서로소 개수(10×9×11)로 조합해 100개 모두 고유 조합 보장
// 정답은 조합 시점에 프로그램적으로 계산 (수기 라벨링 오류 없음)
//
// 실행: npx tsx src/test-text-batch-100.ts

import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const REQUEST_DATE = "2026-06-20"; // 토요일
const TIMEZONE = "Asia/Seoul";
const SUBMITTED_BY = { userId: "U12345", displayName: "진수연" };
const CATEGORIES = [
  { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링", "카페"] },
  { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "삼겹살", "회식"] },
  { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통"] },
  { id: "cat_04", name: "회의비",  keywords: ["회의", "미팅", "세미나"] },
];
const CATEGORIES_TEXT = CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");

// ── 100개 케이스 자동 생성 ──

const DATE_PHRASES = [
  { phrase: "오늘",       resolved: "2026-06-20" },
  { phrase: "어제",       resolved: "2026-06-19" },
  { phrase: "그제",       resolved: "2026-06-18" },
  { phrase: "그저께",     resolved: "2026-06-18" },
  { phrase: "6/15",       resolved: "2026-06-15" },
  { phrase: "6월 10일",   resolved: "2026-06-10" },
  { phrase: "2026-05-28", resolved: "2026-05-28" },
  { phrase: "",           resolved: null }, // 날짜 언급 없음
  { phrase: "지난주에",   resolved: null }, // 모호한 표현 → null이 정답
  { phrase: "저번달",     resolved: null }, // 모호한 표현 → null이 정답
];

const AMOUNT_PHRASES = [
  { phrase: "32000원",      resolved: 32000 },
  { phrase: "32,000원",     resolved: 32000 },
  { phrase: "3만2천원",     resolved: 32000 },
  { phrase: "15000원",      resolved: 15000 },
  { phrase: "오만원",       resolved: 50000 },
  { phrase: "158000원",     resolved: 158000 },
  { phrase: "2만원",        resolved: 20000 },
  { phrase: "1,250,000원",  resolved: 1250000 },
  { phrase: "",             resolved: null }, // 금액 언급 없음
];

const CATEGORY_PHRASES = [
  { phrase: "다과",         categoryId: "cat_01" },
  { phrase: "간식비",       categoryId: "cat_01" },
  { phrase: "카페 이용",    categoryId: "cat_01" },
  { phrase: "점심 식대",    categoryId: "cat_02" },
  { phrase: "회식비",       categoryId: "cat_02" },
  { phrase: "저녁 식사",    categoryId: "cat_02" },
  { phrase: "택시비",       categoryId: "cat_03" },
  { phrase: "버스 이용",    categoryId: "cat_03" },
  { phrase: "세미나 참가비", categoryId: "cat_04" },
  { phrase: "회의 다과",    categoryId: null }, // 다과비/회의비 동률 → null이 정답
  { phrase: "홍보물 제작비", categoryId: null }, // 매칭 카테고리 없음 → null이 정답
];

const MERCHANTS = ["스타벅스", "GS25", "이디야", "OO마트", "올리브영", "CU"];
const PAYERS = ["홍길동", "김철수", "박영희", "이민수", "최지은"];

function buildCase(i: number) {
  const d = DATE_PHRASES[i % DATE_PHRASES.length];
  const a = AMOUNT_PHRASES[i % AMOUNT_PHRASES.length];
  const c = CATEGORY_PHRASES[i % CATEGORY_PHRASES.length];
  const m = (i % 3 === 0) ? MERCHANTS[i % MERCHANTS.length] : null;
  const p = (i % 4 === 0) ? PAYERS[i % PAYERS.length] : null;

  const parts: string[] = [];
  if (d.phrase) parts.push(d.phrase);
  if (m) parts.push(m);
  parts.push(c.phrase);
  if (a.phrase) parts.push(a.phrase);
  if (p) parts.push(p);

  return {
    id: `GEN-${String(i + 1).padStart(3, "0")}`,
    input: parts.join(" "),
    expected: { date: d.resolved, amount: a.resolved, merchant: m, categoryId: c.categoryId, payerName: p },
  };
}

const TEST_CASES = Array.from({ length: 100 }, (_, i) => buildCase(i));

// ── 실제 프로덕션 프롬프트 + Tool Use 직접 호출 (test-text-batch.ts와 동일 방식) ──

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

async function callSonnet(text: string): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929", max_tokens: 1024, temperature: 0,
    tools: [TEXT_PARSE_TOOL], tool_choice: { type: "tool", name: "extract_expense" },
    messages: [{ role: "user", content: buildProdPrompt(text) }],
  });
  const toolUse = message.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!toolUse) throw new Error("Tool Use 응답 없음");
  return toolUse.input as any;
}

function isMatch(actual: any, expected: any): boolean {
  if (expected === null) return actual === null || actual === undefined;
  return actual === expected;
}

async function main() {
  console.log(`\n[텍스트 파싱 100개 검증] 모델: Sonnet (최종 적용 모델)\n`);
  const rows: any[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}] "${tc.input}" → `);
    const row: any = { 케이스: tc.id, 입력: tc.input, 상태: "success", 오류: "" };
    try {
      const t0 = Date.now();
      const r = await callSonnet(tc.input);
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
    await new Promise(r => setTimeout(r, 600));
  }

  const ok = rows.filter(r => r.상태 === "success");
  const pct = (field: string) => ok.length ? `${((ok.filter(r=>r[field]==="Y").length/ok.length)*100).toFixed(1)}%` : "N/A";
  const summary = {
    "테스트 모델": "sonnet (최종 적용)",
    "총 케이스": TEST_CASES.length,
    "API 성공": `${ok.length}개 (${((ok.length/TEST_CASES.length)*100).toFixed(1)}%)`,
    "전체정확도(5필드 모두 일치)": pct("전체일치"),
    "날짜정확도": pct("날짜_일치"),
    "금액정확도": pct("금액_일치"),
    "상호명정확도": pct("상호명_일치"),
    "카테고리정확도": pct("카테고리_일치"),
    "결제자정확도": pct("결제자_일치"),
    "평균응답시간": ok.length ? `${Math.round(ok.reduce((s,r)=>s+r.응답시간ms,0)/ok.length)}ms` : "N/A",
  };

  console.log("\n========== 텍스트 100개 결과 요약 ==========");
  Object.entries(summary).forEach(([k,v]) => console.log(`${k}: ${v}`));
  console.log("==============================================");

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = Object.keys(rows[0]||{}).map(k=>({wch:Math.max(k.length,14)}));
  XLSX.utils.book_append_sheet(wb, ws1, "상세결과");
  const ws2 = XLSX.utils.json_to_sheet(Object.entries(summary).map(([k,v])=>({지표:k,값:v})));
  XLSX.utils.book_append_sheet(wb, ws2, "요약");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `text_results100_sonnet_${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log(`\n📊 엑셀 저장: ${filename}`);
}

main().catch(console.error);
