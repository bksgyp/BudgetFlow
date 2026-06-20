// BudgetFlow OCR 앙상블 테스트 — Haiku + Sonnet + Gemini 투표
// 필드별로 2표 이상 일치하면 채택, 셋 다 다르면 보수적으로 null
//
// 실행: npx tsx src/test-ocr-ensemble.ts

import * as XLSX from "xlsx";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import Anthropic from "@anthropic-ai/sdk";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { callGeminiVision, buildOcrPromptText } from "./multiModelClient";

const CONFIG = {
  S3_BUCKET: process.env.S3_BUCKET_NAME ?? "2026-inha-cc-04-s3",
  S3_PREFIX: "test/ensemble_ocr/",
  S3_REGION: process.env.AWS_REGION_S3 ?? "ap-northeast-2",
  DELAY_MS: 1500,
  KOREAN_COUNT: 10,
  CORD_COUNT: 20,
  CATEGORIES: [
    { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링", "카페", "커피"] },
    { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "음식", "레스토랑"] },
    { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통", "주유"] },
    { id: "cat_04", name: "쇼핑",    keywords: ["의류", "마트", "편의점", "쇼핑", "구매"] },
    { id: "cat_05", name: "기타",    keywords: ["기타", "잡비", "소모품"] },
  ],
};

const DATASETS = [
  ...Array.from({ length: CONFIG.KOREAN_COUNT }, (_, i) => ({
    index: i, type: "korean" as const,
    apiUrl: `https://datasets-server.huggingface.co/rows?dataset=HumynLabs%2FKorean_Receipts_Dataset&config=default&split=train&offset=${i}&length=1`,
  })),
  ...Array.from({ length: CONFIG.CORD_COUNT }, (_, i) => ({
    index: i, type: "cord" as const,
    apiUrl: `https://datasets-server.huggingface.co/rows?dataset=Voxel51%2Fconsolidated_receipt_dataset&config=default&split=train&offset=${i}&length=1`,
  })),
];

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_XLSX = `ensemble_ocr_results_${TIMESTAMP}.xlsx`;
const CATEGORIES_TEXT = CONFIG.CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");

const OCR_PROMPT_TEMPLATE = fs.readFileSync(path.resolve(__dirname, "../prompts/ocr_vision_prompt.txt"), "utf-8");
function buildOcrPrompt(): string {
  return OCR_PROMPT_TEMPLATE.replaceAll("{{categories}}", CATEGORIES_TEXT);
}

// 실제 이미지 바이트로 포맷 감지 (매직바이트) — PNG를 JPEG로 잘못 보내는 버그 수정
function detectMediaType(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return "image/jpeg";
}

const OCR_TOOL: Anthropic.Tool = {
  name: "extract_receipt",
  description: "Extract structured expense data from a Korean receipt image.",
  input_schema: {
    type: "object" as const,
    properties: {
      date:        { type: ["string", "null"], description: "YYYY-MM-DD format from the receipt. null if not visible." },
      merchant:    { type: ["string", "null"], description: "Store or vendor name as printed. null if not visible." },
      amount:      { type: ["integer", "null"], description: "Total payment amount as integer in KRW. null if not found." },
      description: { type: "string", description: "Auto-generated description." },
      categoryId:  { type: ["string", "null"], description: "Must match one of the provided category IDs exactly. null if no match." },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name:      { type: "string" },
            quantity:  { type: ["integer", "null"] },
            unitPrice: { type: ["integer", "null"] },
            amount:    { type: "integer" },
          },
          required: ["name", "quantity", "unitPrice", "amount"],
        },
      },
      confidence: {
        type: "object",
        properties: {
          date: { type: "boolean" }, merchant: { type: "boolean" },
          amount: { type: "boolean" }, items: { type: "boolean" },
          category: { type: "boolean" },
        },
        required: ["date", "merchant", "amount", "items", "category"],
      },
      rawText: { type: "string" },
    },
    required: ["date", "merchant", "amount", "description", "categoryId", "items", "confidence", "rawText"],
  },
};

async function callClaudeVisionDirect(model: string, base64: string, mediaType: string): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    tools: [OCR_TOOL],
    tool_choice: { type: "tool", name: "extract_receipt" },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType as any, data: base64 } },
        { type: "text", text: buildOcrPrompt() },
      ],
    }],
  });
  const toolUse = message.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!toolUse) throw new Error("Tool Use 응답 없음");
  return toolUse.input as any;
}

async function fetchHFImageUrl(apiUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(apiUrl, { headers: { "User-Agent": "BudgetFlow/1.0" } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const url = json.rows?.[0]?.row?.image?.src;
          if (!url) throw new Error("이미지 URL 없음");
          resolve(url);
        } catch(e) { reject(e); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

function downloadImage(url: string, depth = 0): Promise<Buffer> {
  if (depth > 5) return Promise.reject(new Error("리다이렉트 초과"));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { headers: { "User-Agent": "BudgetFlow/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadImage(res.headers.location!, depth + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const s3 = new S3Client({ region: CONFIG.S3_REGION });

async function uploadImageToS3(buf: Buffer, key: string, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: CONFIG.S3_BUCKET, Key: key, Body: buf, ContentType: contentType }));
}

// 필드별 다수결 투표: 2표 이상 일치 → 채택, 셋 다 다르면 → null
function vote(a: any, b: any, c: any): { value: any; agreement: number } {
  const vals = [a, b, c];
  const counts = new Map<string, { value: any; count: number }>();
  for (const v of vals) {
    const key = JSON.stringify(v);
    if (!counts.has(key)) counts.set(key, { value: v, count: 0 });
    counts.get(key)!.count++;
  }
  let best = { value: null as any, count: 0 };
  for (const entry of counts.values()) if (entry.count > best.count) best = entry;
  return { value: best.count >= 2 ? best.value : null, agreement: best.count };
}

function saveExcel(rows: any[], summary: Record<string, any>) {
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
  XLSX.utils.book_append_sheet(wb, ws1, "상세결과");
  const ws2 = XLSX.utils.json_to_sheet(Object.entries(summary).map(([k, v]) => ({ 지표: k, 값: v })));
  ws2["!cols"] = [{ wch: 25 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws2, "요약");
  XLSX.writeFile(wb, OUTPUT_XLSX);
  console.log(`\n📊 엑셀 저장: ${OUTPUT_XLSX}`);
}

async function main() {
  console.log(`\n[OCR 앙상블 테스트] 한국 ${CONFIG.KOREAN_COUNT} + CORD ${CONFIG.CORD_COUNT} = ${DATASETS.length}개\n`);
  const rows: any[] = [];

  for (let i = 0; i < DATASETS.length; i++) {
    const ds = DATASETS[i];
    const idx = i + 1;
    process.stdout.write(`[${idx}/${DATASETS.length}][${ds.type}] `);

    const row: any = {
      순번: idx, 데이터셋: ds.type, 상태: "success",
      haiku_날짜: "", sonnet_날짜: "", gemini_날짜: "", 앙상블_날짜: "", 날짜일치도: 0,
      haiku_상호명: "", sonnet_상호명: "", gemini_상호명: "", 앙상블_상호명: "", 상호명일치도: 0,
      haiku_금액: "", sonnet_금액: "", gemini_금액: "", 앙상블_금액: "", 금액일치도: 0,
      haiku단독_null이었나_앙상블이채움: "N",
      오류: "",
    };

    try {
      const imgUrl = await fetchHFImageUrl(ds.apiUrl);
      const buf = await downloadImage(imgUrl);
      const mediaType = detectMediaType(buf);
      const base64 = buf.toString("base64");
      await uploadImageToS3(buf, `${CONFIG.S3_PREFIX}${ds.type}_${idx}.${mediaType.split("/")[1]}`, mediaType);

      const [haikuR, sonnetR, geminiR] = await Promise.allSettled([
        callClaudeVisionDirect("claude-haiku-4-5-20251001", base64, mediaType),
        callClaudeVisionDirect("claude-sonnet-4-5-20250929", base64, mediaType),
        callGeminiVision(buildOcrPromptText(CATEGORIES_TEXT), base64, mediaType),
      ]);

      const haiku  = haikuR.status  === "fulfilled" ? haikuR.value  : null;
      const sonnet = sonnetR.status === "fulfilled" ? sonnetR.value : null;
      const gemini = geminiR.status === "fulfilled" ? geminiR.value : null;

      row.haiku_날짜  = String(haiku?.date  ?? "null"); row.sonnet_날짜  = String(sonnet?.date  ?? "null"); row.gemini_날짜  = String(gemini?.date  ?? "null");
      row.haiku_상호명= String(haiku?.merchant ?? "null"); row.sonnet_상호명= String(sonnet?.merchant ?? "null"); row.gemini_상호명= String(gemini?.merchant ?? "null");
      row.haiku_금액  = String(haiku?.amount ?? "null"); row.sonnet_금액  = String(sonnet?.amount ?? "null"); row.gemini_금액  = String(gemini?.amount ?? "null");

      const voteDate   = vote(haiku?.date ?? null,     sonnet?.date ?? null,     gemini?.date ?? null);
      const voteMerch  = vote(haiku?.merchant ?? null, sonnet?.merchant ?? null, gemini?.merchant ?? null);
      const voteAmount = vote(haiku?.amount ?? null,   sonnet?.amount ?? null,   gemini?.amount ?? null);

      row.앙상블_날짜 = String(voteDate.value ?? "null");   row.날짜일치도 = voteDate.agreement;
      row.앙상블_상호명 = String(voteMerch.value ?? "null"); row.상호명일치도 = voteMerch.agreement;
      row.앙상블_금액 = String(voteAmount.value ?? "null");  row.금액일치도 = voteAmount.agreement;

      if ((haiku?.date == null || haiku?.merchant == null || haiku?.amount == null) &&
          (voteDate.value != null && voteMerch.value != null && voteAmount.value != null)) {
        row.haiku단독_null이었나_앙상블이채움 = "Y";
      }

      console.log(`✅ 날짜일치=${row.날짜일치도} 상호일치=${row.상호명일치도} 금액일치=${row.금액일치도}`);
    } catch (e: any) {
      row.상태 = "error"; row.오류 = e.message;
      console.log(`❌ ${e.message}`);
    }

    rows.push(row);
    if (i < DATASETS.length - 1) await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
  }

  const ok = rows.filter(r => r.상태 === "success");
  const avgAgree = (field: string) => ok.length ? (ok.reduce((s, r) => s + r[field], 0) / ok.length).toFixed(2) : "N/A";
  const fullAgree = (field: string) => ok.filter(r => r[field] === 3).length;
  const rescued = ok.filter(r => r.haiku단독_null이었나_앙상블이채움 === "Y").length;

  const summary = {
    "총 샘플 수": DATASETS.length,
    "성공": ok.length,
    "날짜 평균 일치도(0~3)": avgAgree("날짜일치도"),
    "상호명 평균 일치도(0~3)": avgAgree("상호명일치도"),
    "금액 평균 일치도(0~3)": avgAgree("금액일치도"),
    "날짜 3/3 완전일치": `${fullAgree("날짜일치도")}/${ok.length}`,
    "상호명 3/3 완전일치": `${fullAgree("상호명일치도")}/${ok.length}`,
    "금액 3/3 완전일치": `${fullAgree("금액일치도")}/${ok.length}`,
    "Haiku단독 null이었는데 앙상블이 채운 케이스": `${rescued}/${ok.length}`,
    "테스트 일시": TIMESTAMP,
  };

  console.log("\n========== 앙상블 요약 ==========");
  Object.entries(summary).forEach(([k, v]) => console.log(`${k}: ${v}`));
  console.log("===================================");
  saveExcel(rows, summary);
}

main().catch(console.error);
