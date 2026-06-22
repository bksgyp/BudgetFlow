// BudgetFlow TaxOps 텍스트 파싱 100개 검증
// 결제수단/업무목적 명시 여부로 정답 계산 가능한 필드만 자동 검증
// (taxInvoiceType/vatClass는 텍스트에 영수증이 없어서 자동검증 제외)
//
// 실행: npx tsx src/test-taxops-text-100.ts

import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const REQUEST_DATE = "2026-06-22";
const TIMEZONE = "Asia/Seoul";
const SUBMITTED_BY = { userId: "U12345", displayName: "진수연" };
const CATEGORIES = [
  { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링", "카페"] },
  { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "삼겹살"] },
  { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통"] },
  { id: "cat_04", name: "회의비",  keywords: ["회의", "미팅", "세미나"] },
];
const CATEGORIES_TEXT = CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");

// ── 케이스 생성 배열 ──

const DATE_PHRASES = [
  { phrase: "오늘",       resolved: "2026-06-22" },
  { phrase: "어제",       resolved: "2026-06-21" },
  { phrase: "그제",       resolved: "2026-06-20" },
  { phrase: "6/10",       resolved: "2026-06-10" },
  { phrase: "6월 5일",    resolved: "2026-06-05" },
  { phrase: "2026-05-20", resolved: "2026-05-20" },
  { phrase: "",           resolved: null },  // 날짜 없음
  { phrase: "지난주에",   resolved: null },  // 모호 → null
  { phrase: "저번달",     resolved: null },  // 모호 → null
  { phrase: "며칠 전",    resolved: null },  // 모호 → null
];

const AMOUNT_PHRASES = [
  { phrase: "32000원",     resolved: 32000 },
  { phrase: "15,000원",    resolved: 15000 },
  { phrase: "오만원",      resolved: 50000 },
  { phrase: "158,000원",   resolved: 158000 },
  { phrase: "2만원",       resolved: 20000 },
  { phrase: "3만2천원",    resolved: 32000 },
  { phrase: "75000원",     resolved: 75000 },
  { phrase: "100,000원",   resolved: 100000 },
  { phrase: "",            resolved: null },  // 금액 없음
];

const PAYMENT_PHRASES = [
  { phrase: "법인카드로",   expected: "corporate_card" },
  { phrase: "개인카드로",   expected: "personal_card"  },
  { phrase: "현금으로",     expected: "cash"            },
  { phrase: "",             expected: "unknown"         },  // 언급 없음
];

const BUSINESS_PHRASES = [
  { phrase: "팀 미팅 다과",   hasPurpose: true,  deductibility: "likely_deductible" },
  { phrase: "출장 식비",      hasPurpose: true,  deductibility: "likely_deductible" },
  { phrase: "세미나 참가비",  hasPurpose: true,  deductibility: "likely_deductible" },
  { phrase: "",               hasPurpose: false, deductibility: "unknown"            },
];

const CATEGORY_PHRASES = [
  "다과", "카페 이용", "점심 식대", "회식비", "택시비", "세미나 비용",
  "간식비", "저녁 식사", "버스 이용", "회의 준비", "교통비",
];

const MERCHANTS = ["스타벅스", "GS25", "이디야", "올리브영", "CU", ""];

// taxReviewStatus 정답 계산
function expectedTaxReviewStatus(amountResolved: number | null, dateResolved: string | null): string {
  if (amountResolved === null) return "blocked";
  if (dateResolved === null) return "needs_review";
  return "ready";
}

function buildCase(i: number) {
  const d = DATE_PHRASES[i % DATE_PHRASES.length];
  const a = AMOUNT_PHRASES[i % AMOUNT_PHRASES.length];
  const p = PAYMENT_PHRASES[i % PAYMENT_PHRASES.length];
  const b = BUSINESS_PHRASES[i % BUSINESS_PHRASES.length];
  const cat = CATEGORY_PHRASES[i % CATEGORY_PHRASES.length];
  const merchant = MERCHANTS[i % MERCHANTS.length];

  const parts: string[] = [];
  if (d.phrase) parts.push(d.phrase);
  if (p.phrase) parts.push(p.phrase);
  if (merchant) parts.push(merchant);
  if (b.phrase) parts.push(b.phrase);
  else parts.push(cat);
  if (a.phrase) parts.push(a.phrase);

  return {
    id: `TAXOPS-${String(i + 1).padStart(3, "0")}`,
    input: parts.join(" "),
    expected: {
      paymentMethod:   p.expected,
      businessPurpose: b.hasPurpose ? b.phrase : null,  // null이면 "null이어야 함"
      deductibility:   b.deductibility,
      taxReviewStatus: expectedTaxReviewStatus(a.resolved, d.resolved),
    },
  };
}

const TEST_CASES = Array.from({ length: 100 }, (_, i) => buildCase(i));

// ── Sonnet 직접 호출 ──

const PROMPT_TEMPLATE = fs.readFileSync(
  path.resolve(__dirname, "../prompts/text_parse_prompt.txt"), "utf-8"
);

function buildPrompt(text: string): string {
  return PROMPT_TEMPLATE
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
      date: { type: ["string", "null"] }, amount: { type: ["integer", "null"] },
      merchant: { type: ["string", "null"] }, description: { type: "string" },
      categoryId: { type: ["string", "null"] }, payerName: { type: ["string", "null"] },
      confidence: {
        type: "object",
        properties: { date:{type:"boolean"}, amount:{type:"boolean"}, category:{type:"boolean"}, payerName:{type:"boolean"} },
        required: ["date","amount","category","payerName"],
      },
      taxInvoiceType: { type: ["string","null"] }, paymentMethod: { type: ["string","null"] },
      businessPurpose: { type: ["string","null"] }, vatClass: { type: ["string","null"] },
      vatReason: { type: ["string","null"] }, deductibility: { type: ["string","null"] },
      taxReviewStatus: { type: "string" }, taxReviewReason: { type: ["string","null"] },
    },
    required: ["date","amount","merchant","description","categoryId","payerName","confidence",
               "taxInvoiceType","paymentMethod","businessPurpose","vatClass","vatReason",
               "deductibility","taxReviewStatus","taxReviewReason"],
  },
};

async function callSonnet(text: string): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929", max_tokens: 1024, temperature: 0,
    tools: [TEXT_PARSE_TOOL], tool_choice: { type: "tool", name: "extract_expense" },
    messages: [{ role: "user", content: buildPrompt(text) }],
  });
  const toolUse = message.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!toolUse) throw new Error("Tool Use 응답 없음");
  return toolUse.input;
}

function matchPayment(actual: string | null, expected: string): boolean {
  if (expected === "unknown") return actual === "unknown" || actual === null;
  return actual === expected;
}

function matchDeductibility(actual: string | null, expected: string): boolean {
  if (expected === "unknown") return actual === "unknown" || actual === null;
  return actual === expected;
}

async function main() {
  console.log(`\n[TaxOps 텍스트 100개 검증] 모델: Sonnet\n`);
  const rows: any[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}] `);
    const row: any = {
      케이스: tc.id, 입력: tc.input, 상태: "success", 오류: "",
      결제수단_예상: tc.expected.paymentMethod,
      업무목적_예상: tc.expected.businessPurpose ?? "null",
      공제가능성_예상: tc.expected.deductibility,
      세무검토상태_예상: tc.expected.taxReviewStatus,
    };

    try {
      const t0 = Date.now();
      const r = await callSonnet(tc.input);
      row.응답시간ms = Date.now() - t0;

      row.결제수단_실제 = r.paymentMethod ?? "null";
      row.결제수단_일치 = matchPayment(r.paymentMethod, tc.expected.paymentMethod) ? "Y" : "N";

      row.업무목적_실제 = r.businessPurpose ?? "null";
      // 업무목적은 null이면 "null이어야 함", 아니면 "값이 있어야 함"
      const purposeExpectNull = tc.expected.businessPurpose === null;
      row.업무목적_일치 = purposeExpectNull
        ? (r.businessPurpose === null || r.businessPurpose === undefined ? "Y" : "N")
        : (r.businessPurpose !== null && r.businessPurpose !== undefined ? "Y" : "N");

      row.공제가능성_실제 = r.deductibility ?? "null";
      row.공제가능성_일치 = matchDeductibility(r.deductibility, tc.expected.deductibility) ? "Y" : "N";

      row.세무검토상태_실제 = r.taxReviewStatus ?? "null";
      row.세무검토상태_일치 = r.taxReviewStatus === tc.expected.taxReviewStatus ? "Y" : "N";

      row.taxInvoiceType = r.taxInvoiceType ?? "null";
      row.vatClass       = r.vatClass ?? "null";
      row.vatReason      = r.vatReason ?? "";
      row.taxReviewReason = r.taxReviewReason ?? "";

      const allMatch = [row.결제수단_일치, row.업무목적_일치, row.공제가능성_일치, row.세무검토상태_일치].every(v => v === "Y");
      row.전체일치 = allMatch ? "Y" : "N";
      console.log(`${allMatch ? "✅" : "⚠️"} ${row.응답시간ms}ms | 결제수단:${row.결제수단_일치} 업무목적:${row.업무목적_일치} 공제:${row.공제가능성_일치} 세무:${row.세무검토상태_일치}`);
    } catch (e: any) {
      row.상태 = "error"; row.오류 = e.message; row.전체일치 = "N";
      console.log(`❌ ${e.message}`);
    }
    rows.push(row);
    await new Promise(r => setTimeout(r, 600));
  }

  const ok = rows.filter(r => r.상태 === "success");
  const pct = (f: string) => ok.length ? `${((ok.filter(r=>r[f]==="Y").length/ok.length)*100).toFixed(1)}%` : "N/A";

  console.log("\n========== TaxOps 텍스트 100개 결과 ==========");
  console.log(`총 케이스: ${TEST_CASES.length}, API 성공: ${ok.length}`);
  console.log(`전체정확도(4필드 모두): ${pct("전체일치")}`);
  console.log(`결제수단 정확도:    ${pct("결제수단_일치")}`);
  console.log(`업무목적 정확도:    ${pct("업무목적_일치")}`);
  console.log(`공제가능성 정확도:  ${pct("공제가능성_일치")}`);
  console.log(`세무검토상태 정확도: ${pct("세무검토상태_일치")}`);
  console.log(`평균 응답시간: ${ok.length ? Math.round(ok.reduce((s,r)=>s+r.응답시간ms,0)/ok.length) : 0}ms`);
  console.log("==============================================");

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0]||{}).map(()=>({wch:18}));
  XLSX.utils.book_append_sheet(wb, ws, "상세결과");
  const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
  const filename = `taxops_text_100_${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log(`\n📊 엑셀 저장: ${filename}`);
}

main().catch(console.error);
