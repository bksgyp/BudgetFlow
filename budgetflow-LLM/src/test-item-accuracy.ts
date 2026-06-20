// BudgetFlow 품목명(items[].name) 추출 품질 점검 — 한국 영수증 20개, Haiku
//
// 정답 라벨이 없어 "items[].name이 모델 자신의 rawText 전사 안에 실제로 등장하는지"로
// 1차 검증 (환각/날조 탐지). rawText·품목명 전문을 엑셀에 그대로 보존해서 사람이 직접
// 몇 개 샘플을 눈으로 검수할 수 있게 함 — 멘토님이 지적한 "상품명 OCR 깨짐" 패턴은
// 사람이 직접 봐야 가장 정확히 판단됨.
//
// 실행: npx tsx src/test-item-accuracy.ts

import * as XLSX from "xlsx";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import Anthropic from "@anthropic-ai/sdk";
import https from "https";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const CONFIG = {
  S3_BUCKET: process.env.S3_BUCKET_NAME ?? "2026-inha-cc-04-s3",
  S3_PREFIX: "test/item_accuracy/",
  S3_REGION: process.env.AWS_REGION_S3 ?? "ap-northeast-2",
  DELAY_MS: 1500,
  KOREAN_COUNT: 20,
  CATEGORIES: [
    { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링", "카페", "커피"] },
    { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "음식", "레스토랑"] },
    { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통", "주유"] },
    { id: "cat_04", name: "쇼핑",    keywords: ["의류", "마트", "편의점", "쇼핑", "구매"] },
    { id: "cat_05", name: "기타",    keywords: ["기타", "잡비", "소모품"] },
  ],
};

const SAMPLES = Array.from({ length: CONFIG.KOREAN_COUNT }, (_, i) => ({
  index: i,
  apiUrl: `https://datasets-server.huggingface.co/rows?dataset=HumynLabs%2FKorean_Receipts_Dataset&config=default&split=train&offset=${i}&length=1`,
}));

const CATEGORIES_TEXT = CONFIG.CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");
const OCR_PROMPT_TEMPLATE = fs.readFileSync(path.resolve(__dirname, "../prompts/ocr_vision_prompt.txt"), "utf-8");
function buildOcrPrompt(): string {
  return OCR_PROMPT_TEMPLATE.replaceAll("{{categories}}", CATEGORIES_TEXT);
}

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
      date: { type: ["string", "null"] }, merchant: { type: ["string", "null"] },
      amount: { type: ["integer", "null"] }, description: { type: "string" },
      categoryId: { type: ["string", "null"] },
      items: {
        type: "array",
        items: { type: "object", properties: {
          name: { type: "string" }, quantity: { type: ["integer", "null"] },
          unitPrice: { type: ["integer", "null"] }, amount: { type: "integer" },
        }, required: ["name", "quantity", "unitPrice", "amount"] },
      },
      confidence: {
        type: "object",
        properties: { date:{type:"boolean"}, merchant:{type:"boolean"}, amount:{type:"boolean"}, items:{type:"boolean"}, category:{type:"boolean"} },
        required: ["date", "merchant", "amount", "items", "category"],
      },
      rawText: { type: "string" },
    },
    required: ["date", "merchant", "amount", "description", "categoryId", "items", "confidence", "rawText"],
  },
};

async function callHaikuVision(base64: string, mediaType: string): Promise<any> {
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
    https.get(url, { headers: { "User-Agent": "BudgetFlow/1.0" } }, (res) => {
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

function normalize(s: string): string {
  return (s ?? "").replace(/\s/g, "").toLowerCase();
}

async function main() {
  console.log(`\n[품목명 추출 품질 점검] 한국 영수증 ${CONFIG.KOREAN_COUNT}개, Haiku\n`);
  const rows: any[] = [];

  for (const sample of SAMPLES) {
    const idx = sample.index + 1;
    process.stdout.write(`[${idx}/${CONFIG.KOREAN_COUNT}] `);
    const row: any = { 순번: idx, 상태: "success", 상호명: "", 품목수: 0, 일치품목수: 0, 일치율: "", 품목목록: "", rawText: "", 오류: "" };

    try {
      const imgUrl = await fetchHFImageUrl(sample.apiUrl);
      const buf = await downloadImage(imgUrl);
      const mediaType = detectMediaType(buf);
      const base64 = buf.toString("base64");
      await uploadImageToS3(buf, `${CONFIG.S3_PREFIX}korean_${idx}.${mediaType.split("/")[1]}`, mediaType);

      const r = await callHaikuVision(base64, mediaType);
      const items: any[] = r.items ?? [];
      const rawText: string = r.rawText ?? "";
      const normRaw = normalize(rawText);

      const matched = items.filter(it => it.name && normRaw.includes(normalize(it.name)));

      row.상호명 = r.merchant ?? "null";
      row.품목수 = items.length;
      row.일치품목수 = matched.length;
      row.일치율 = items.length ? `${((matched.length / items.length) * 100).toFixed(0)}%` : "N/A";
      row.품목목록 = items.map(it => `${it.name}(${it.amount})`).join(" | ");
      row.rawText = rawText;

      console.log(`✅ 품목 ${items.length}개 중 ${matched.length}개 rawText 일치 (${row.일치율})`);
    } catch(e: any) {
      row.상태 = "error"; row.오류 = e.message;
      console.log(`❌ ${e.message}`);
    }

    rows.push(row);
    if (sample.index < CONFIG.KOREAN_COUNT - 1) await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
  }

  const ok = rows.filter(r => r.상태 === "success" && r.품목수 > 0);
  const totalItems = ok.reduce((s, r) => s + r.품목수, 0);
  const totalMatched = ok.reduce((s, r) => s + r.일치품목수, 0);

  console.log("\n========== 품목명 점검 요약 ==========");
  console.log(`총 영수증: ${rows.length}, 품목 1개 이상 추출된 영수증: ${ok.length}`);
  console.log(`전체 품목 수: ${totalItems}, rawText 일치 품목 수: ${totalMatched}`);
  console.log(`전체 일치율: ${totalItems ? ((totalMatched/totalItems)*100).toFixed(1) : 0}%`);
  console.log("=========================================");
  console.log("\n⚠️ rawText 일치율이 낮은 영수증부터 직접 눈으로 확인하세요 (엑셀의 품목목록/rawText 열):");
  ok.filter(r => parseInt(r.일치율) < 100).forEach(r => console.log(`  - 순번 ${r.순번} (${r.상호명}): ${r.일치율} — ${r.품목목록}`));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{wch:8},{wch:10},{wch:15},{wch:8},{wch:10},{wch:8},{wch:50},{wch:80},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, "상세결과");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `item_accuracy_${ts}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log(`\n📊 엑셀 저장: ${filename}`);
}

main().catch(console.error);
