// BudgetFlow TaxOps OCR 20개 검증 (한국 영수증)
// TaxOps 필드는 외부 정답 라벨이 없어서 자동 수치화 대신
// 엑셀로 뽑아서 직접 눈으로 검수하는 방식
//
// 실행: npx tsx src/test-taxops-ocr-20.ts

import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import https from "https";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const CATEGORIES = [
  { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링", "카페", "커피"] },
  { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "음식"] },
  { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통", "주유"] },
  { id: "cat_04", name: "쇼핑",    keywords: ["의류", "마트", "편의점", "쇼핑", "구매"] },
  { id: "cat_05", name: "기타",    keywords: ["기타", "잡비", "소모품"] },
];
const CATEGORIES_TEXT = CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");
const OCR_PROMPT_TEMPLATE = fs.readFileSync(path.resolve(__dirname, "../prompts/ocr_vision_prompt.txt"), "utf-8");

function buildOcrPrompt() {
  return OCR_PROMPT_TEMPLATE.replaceAll("{{categories}}", CATEGORIES_TEXT);
}

function detectMediaType(buf: Buffer): "image/jpeg"|"image/png"|"image/webp"|"image/gif" {
  if (buf[0]===0x89&&buf[1]===0x50) return "image/png";
  if (buf[0]===0x47&&buf[1]===0x49) return "image/gif";
  if (buf[0]===0x52&&buf[1]===0x49) return "image/webp";
  return "image/jpeg";
}

const OCR_TOOL: Anthropic.Tool = {
  name: "extract_receipt",
  description: "Extract structured expense and tax data from a Korean receipt image.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: {type:["string","null"]}, merchant: {type:["string","null"]},
      amount: {type:["integer","null"]}, description: {type:"string"},
      categoryId: {type:["string","null"]},
      items: { type:"array", items:{type:"object", properties:{name:{type:"string"},quantity:{type:["integer","null"]},unitPrice:{type:["integer","null"]},amount:{type:"integer"}}, required:["name","quantity","unitPrice","amount"]} },
      confidence: { type:"object", properties:{date:{type:"boolean"},merchant:{type:"boolean"},amount:{type:"boolean"},items:{type:"boolean"},category:{type:"boolean"}}, required:["date","merchant","amount","items","category"] },
      rawText: {type:"string"},
      taxInvoiceType: {type:["string","null"]}, paymentMethod: {type:["string","null"]},
      businessPurpose: {type:["string","null"]}, vatClass: {type:["string","null"]},
      vatReason: {type:["string","null"]}, deductibility: {type:["string","null"]},
      taxReviewStatus: {type:"string"}, taxReviewReason: {type:["string","null"]},
      ocrQuality: {type:"string"}, ocrFailureMode: {type:"string"},
      extractedTaxFields: {type:["object","null"], properties:{supplyAmount:{type:["integer","null"]},vatAmount:{type:["integer","null"]},totalAmount:{type:["integer","null"]}}}
    },
    required: ["date","merchant","amount","description","categoryId","items","confidence","rawText",
               "taxInvoiceType","paymentMethod","businessPurpose","vatClass","vatReason",
               "deductibility","taxReviewStatus","taxReviewReason","ocrQuality","ocrFailureMode","extractedTaxFields"],
  },
};

async function callHaiku(base64: string, mediaType: string): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001", max_tokens: 2048, temperature: 0,
    tools: [OCR_TOOL], tool_choice: { type: "tool", name: "extract_receipt" },
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mediaType as any, data: base64 } },
      { type: "text", text: buildOcrPrompt() },
    ]}],
  });
  const toolUse = message.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!toolUse) throw new Error("Tool Use 응답 없음");
  return toolUse.input;
}

async function fetchHFImageUrl(index: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://datasets-server.huggingface.co/rows?dataset=HumynLabs%2FKorean_Receipts_Dataset&config=default&split=train&offset=${index}&length=1`;
    https.get(url, { headers: { "User-Agent": "BudgetFlow/1.0" } }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data).rows?.[0]?.row?.image?.src); } catch(e) { reject(e); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

function downloadImage(url: string, depth=0): Promise<Buffer> {
  if (depth > 5) return Promise.reject(new Error("리다이렉트 초과"));
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "BudgetFlow/1.0" } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadImage(res.headers.location!, depth+1).then(resolve).catch(reject); return;
      }
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  console.log("\n[TaxOps OCR 20개 검증] 모델: Haiku (한국 영수증)\n");
  const rows: any[] = [];

  for (let i = 0; i < 20; i++) {
    process.stdout.write(`[${i+1}/20] `);
    const row: any = { 순번: i+1, 상태: "success", 오류: "" };
    try {
      const imgUrl = await fetchHFImageUrl(i);
      const buf = await downloadImage(imgUrl);
      const mediaType = detectMediaType(buf);
      const base64 = buf.toString("base64");

      const t0 = Date.now();
      const r = await callHaiku(base64, mediaType);
      row.응답시간ms = Date.now() - t0;

      row.상호명       = r.merchant ?? "null";
      row.날짜         = r.date ?? "null";
      row.금액         = r.amount ?? "null";
      row.taxInvoiceType = r.taxInvoiceType ?? "null";
      row.paymentMethod  = r.paymentMethod ?? "null";
      row.businessPurpose = r.businessPurpose ?? "null";
      row.vatClass       = r.vatClass ?? "null";
      row.vatReason      = r.vatReason ?? "";
      row.deductibility  = r.deductibility ?? "null";
      row.taxReviewStatus = r.taxReviewStatus;
      row.taxReviewReason = r.taxReviewReason ?? "";
      row.ocrQuality     = r.ocrQuality;
      row.ocrFailureMode = r.ocrFailureMode;
      row.supplyAmount   = r.extractedTaxFields?.supplyAmount ?? "null";
      row.vatAmount      = r.extractedTaxFields?.vatAmount ?? "null";
      row.totalAmount    = r.extractedTaxFields?.totalAmount ?? "null";
      row.품목수         = (r.items ?? []).length;
      row.ocrRawText     = r.rawText ?? "";

      console.log(`✅ ${r.merchant ?? "?"} | ${r.taxInvoiceType} | ${r.vatClass} | ${r.ocrQuality} | ${row.응답시간ms}ms`);
    } catch(e: any) {
      row.상태 = "error"; row.오류 = e.message;
      console.log(`❌ ${e.message}`);
    }
    rows.push(row);
    await new Promise(r => setTimeout(r, 1500));
  }

  // taxInvoiceType 분포
  const ok = rows.filter(r => r.상태 === "success");
  const dist = (field: string) => {
    const counts: Record<string, number> = {};
    ok.forEach(r => { counts[r[field]] = (counts[r[field]]||0)+1; });
    return Object.entries(counts).map(([k,v]) => `${k}:${v}`).join(", ");
  };

  console.log("\n========== TaxOps OCR 20개 결과 ==========");
  console.log(`성공: ${ok.length}/20`);
  console.log(`taxInvoiceType 분포: ${dist("taxInvoiceType")}`);
  console.log(`paymentMethod 분포:  ${dist("paymentMethod")}`);
  console.log(`vatClass 분포:       ${dist("vatClass")}`);
  console.log(`ocrQuality 분포:     ${dist("ocrQuality")}`);
  console.log(`taxReviewStatus 분포: ${dist("taxReviewStatus")}`);
  console.log("============================================");
  console.log("\n⚠️ 직접 검수 필요 — 엑셀의 taxInvoiceType/vatClass/ocrQuality 열을 실제 영수증과 비교하세요.");

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0]||{}).map(k => ({wch: k==="ocrRawText"?60:18}));
  XLSX.utils.book_append_sheet(wb, ws, "상세결과");
  const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
  const filename = `taxops_ocr_20_${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log(`\n📊 엑셀 저장: ${filename}`);
}

main().catch(console.error);
