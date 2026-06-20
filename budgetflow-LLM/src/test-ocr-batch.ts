// BudgetFlow OCR 배치 테스트 — 멀티모델 벤치마킹
// 한국 영수증 20개 (HumynLabs) + 인도네시아 영수증 80개 (CORD) = 100개
//
// 실행:
//   npx tsx src/test-ocr-batch.ts                          # haiku
//   ANTHROPIC_MODEL=claude-sonnet-4-5-20250929 npx tsx ... # sonnet
//   TEST_MODEL=gemini npx tsx src/test-ocr-batch.ts        # gemini

import * as XLSX from "xlsx";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import https from "https";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

import { callGeminiVision, buildOcrPromptText } from "./multiModelClient";

const TEST_MODEL      = process.env.TEST_MODEL ?? "haiku";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
const MODEL_LABEL     = TEST_MODEL === "gemini" ? "gemini"
  : ANTHROPIC_MODEL.includes("sonnet") ? "sonnet" : "haiku";

const CONFIG = {
  LLM_SERVER:     "http://localhost:4000",
  S3_BUCKET:      process.env.S3_BUCKET_NAME ?? "2026-inha-cc-04-s3",
  S3_PREFIX:      `test/batch100/${MODEL_LABEL}/`,
  S3_REGION:      process.env.AWS_REGION_S3  ?? "ap-northeast-2",
  DELAY_MS:       1500,
  CATEGORIES: [
    { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링", "카페", "커피"] },
    { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "음식", "레스토랑"] },
    { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통", "주유"] },
    { id: "cat_04", name: "쇼핑",    keywords: ["의류", "마트", "편의점", "쇼핑", "구매"] },
    { id: "cat_05", name: "기타",    keywords: ["기타", "잡비", "소모품"] },
  ],
};

// 데이터셋 구성: 한국 20개 + CORD 80개
const DATASETS = [
  // 한국 영수증 20개
  ...Array.from({ length: 20 }, (_, i) => ({
    index: i,
    type: "korean" as const,
    apiUrl: `https://datasets-server.huggingface.co/rows?dataset=HumynLabs%2FKorean_Receipts_Dataset&config=default&split=train&offset=${i}&length=1`,
  })),
  // CORD 인도네시아 영수증 80개
  ...Array.from({ length: 80 }, (_, i) => ({
    index: i,
    type: "cord" as const,
    apiUrl: `https://datasets-server.huggingface.co/rows?dataset=Voxel51%2Fconsolidated_receipt_dataset&config=default&split=train&offset=${i}&length=1`,
  })),
];

const TIMESTAMP   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_XLSX = `ocr_results100_${MODEL_LABEL}_${TIMESTAMP}.xlsx`;
const CATEGORIES_TEXT = CONFIG.CATEGORIES.map(c => `- ${c.id} | ${c.name} | keywords: ${c.keywords.join(", ")}`).join("\n");

// ─────────────────────────────────────────
// HuggingFace 이미지 URL 조회
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// 이미지 다운로드
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// S3
// ─────────────────────────────────────────

const s3 = new S3Client({ region: CONFIG.S3_REGION });

async function uploadImageToS3(buf: Buffer, key: string) {
  await s3.send(new PutObjectCommand({
    Bucket: CONFIG.S3_BUCKET, Key: key, Body: buf, ContentType: "image/jpeg",
  }));
}

async function uploadJsonToS3(data: unknown, key: string) {
  await s3.send(new PutObjectCommand({
    Bucket: CONFIG.S3_BUCKET, Key: key,
    Body: JSON.stringify(data, null, 2), ContentType: "application/json",
  }));
}

async function getImageFromS3(key: string): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const res = await s3.send(new GetObjectCommand({ Bucket: CONFIG.S3_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return { base64: Buffer.from(bytes).toString("base64"), mediaType: "image/jpeg" };
}

// ─────────────────────────────────────────
// LLM 호출
// ─────────────────────────────────────────

async function callClaudeServer(s3Key: string, evidenceFileId: string) {
  const res = await fetch(`${CONFIG.LLM_SERVER}/analyze/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputType: "image", s3Key, projectId: "test_batch100", evidenceFileId,
      submittedBy: { userId: "U_TEST", displayName: "배치테스트" },
      categories: CONFIG.CATEGORIES,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

function normalizeResult(raw: any) {
  const c = raw.confidence ?? {};
  const score = (c.date?0.2:0)+(c.merchant?0.2:0)+(c.amount?0.3:0)+(c.items?0.2:0)+(c.category?0.1:0);
  return {
    evidenceStatus: raw.date || raw.amount ? "ocr_completed" : "ocr_failed",
    date: raw.date ?? null, merchant: raw.merchant ?? null, amount: raw.amount ?? null,
    itemCount: raw.items?.length ?? 0, categoryId: raw.categoryId ?? null,
    aiConfidence: Math.round(score * 10) / 10,
    needsReview: score < 0.7, missingFields: [], reviewReason: "",
  };
}

// ─────────────────────────────────────────
// 엑셀 저장
// ─────────────────────────────────────────

function saveExcel(rows: any[], summary: Record<string, any>) {
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = Object.keys(rows[0]||{}).map(k=>({wch:Math.max(k.length,14)}));
  XLSX.utils.book_append_sheet(wb, ws1, "상세결과");
  const ws2 = XLSX.utils.json_to_sheet(Object.entries(summary).map(([k,v])=>({지표:k,값:v})));
  ws2["!cols"] = [{wch:25},{wch:25}];
  XLSX.utils.book_append_sheet(wb, ws2, "요약");
  XLSX.writeFile(wb, OUTPUT_XLSX);
  console.log(`\n📊 엑셀 저장: ${OUTPUT_XLSX}`);
}

function buildSummary(rows: any[]) {
  const total = rows.length;
  const ok    = rows.filter(r => r.상태 === "success");
  const kor   = rows.filter(r => r.데이터셋 === "korean");
  const cord  = rows.filter(r => r.데이터셋 === "cord");
  const korOk = kor.filter(r => r.상태 === "success");
  const cordOk= cord.filter(r => r.상태 === "success");
  const pct   = (n:number, d:number) => d===0?"0%":`${((n/d)*100).toFixed(1)}%`;

  return {
    "테스트 모델":              MODEL_LABEL,
    "총 이미지 수":             total,
    "API 성공":                `${ok.length}개 (${pct(ok.length,total)})`,
    "OCR 완료":                `${rows.filter(r=>r.evidenceStatus==="ocr_completed").length}개`,
    "검토 필요":                `${rows.filter(r=>r.검토필요==="Y").length}개`,
    "날짜 추출 성공률 (전체)":  pct(ok.filter(r=>r.날짜성공==="Y").length, ok.length),
    "상호명 추출 성공률 (전체)":pct(ok.filter(r=>r.상호명성공==="Y").length, ok.length),
    "금액 추출 성공률 (전체)":  pct(ok.filter(r=>r.금액성공==="Y").length, ok.length),
    "날짜 추출 성공률 (한국)":  pct(korOk.filter(r=>r.날짜성공==="Y").length, korOk.length),
    "금액 추출 성공률 (한국)":  pct(korOk.filter(r=>r.금액성공==="Y").length, korOk.length),
    "날짜 추출 성공률 (CORD)":  pct(cordOk.filter(r=>r.날짜성공==="Y").length, cordOk.length),
    "금액 추출 성공률 (CORD)":  pct(cordOk.filter(r=>r.금액성공==="Y").length, cordOk.length),
    "평균 신뢰도":              ok.length>0?(ok.reduce((s,r)=>s+r.신뢰도,0)/ok.length).toFixed(3):"N/A",
    "평균 응답 시간":           ok.length>0?`${Math.round(ok.reduce((s,r)=>s+r.응답시간ms,0)/ok.length)}ms`:"N/A",
    "테스트 일시":              TIMESTAMP,
  };
}

// ─────────────────────────────────────────
// 메인
// ─────────────────────────────────────────

async function main() {
  console.log(`\n[배치 테스트 100개] 모델: ${MODEL_LABEL} | 한국 20 + CORD 80\n`);
  const rows: any[] = [];

  for (let i = 0; i < DATASETS.length; i++) {
    const ds     = DATASETS[i];
    const idx    = i + 1;
    const s3Img  = `${CONFIG.S3_PREFIX}${ds.type}_${String(ds.index+1).padStart(3,"0")}.jpg`;
    const s3Json = `${CONFIG.S3_PREFIX}result_${String(idx).padStart(3,"0")}.json`;
    const evfId  = `evf_batch100_${MODEL_LABEL}_${String(idx).padStart(3,"0")}`;

    const row: any = {
      순번: idx, 데이터셋: ds.type, 모델: MODEL_LABEL, 상태: "success", evidenceStatus: "",
      날짜추출: "null", 날짜성공: "N", 상호명추출: "null", 상호명성공: "N",
      금액추출: "null", 금액성공: "N", 품목수: 0, 카테고리: "null",
      신뢰도: 0, 검토필요: "N", 누락필드: "", 검토사유: "",
      응답시간ms: 0, s3이미지키: s3Img, 오류: "",
    };

    process.stdout.write(`[${idx}/100][${ds.type}] `);

    try {
      // 1. HF URL 조회
      process.stdout.write("URL → ");
      let imgUrl: string;
      try { imgUrl = await fetchHFImageUrl(ds.apiUrl); }
      catch(e: any) { row.상태="fetch_failed"; row.오류=e.message; console.log(`❌ ${e.message}`); rows.push(row); continue; }

      // 2. 다운로드
      process.stdout.write("다운 → ");
      let buf: Buffer;
      try { buf = await downloadImage(imgUrl); }
      catch(e: any) { row.상태="download_failed"; row.오류=e.message; console.log(`❌ ${e.message}`); rows.push(row); continue; }

      // 3. S3 업로드
      process.stdout.write("S3↑ → ");
      try { await uploadImageToS3(buf, s3Img); }
      catch(e: any) { row.상태="upload_failed"; row.오류=e.message; console.log(`❌ ${e.message}`); rows.push(row); continue; }

      // 4. LLM 분석
      process.stdout.write("OCR → ");
      const t0 = Date.now();
      let result: any;

      if (TEST_MODEL === "gemini") {
        const { base64, mediaType } = await getImageFromS3(s3Img);
        const raw = await callGeminiVision(buildOcrPromptText(CATEGORIES_TEXT), base64, mediaType);
        result = normalizeResult(raw);
      } else {
        result = await callClaudeServer(s3Img, evfId);
      }
      row.응답시간ms = Date.now() - t0;

      try { await uploadJsonToS3({ imageKey: s3Img, dataset: ds.type, model: MODEL_LABEL, result }, s3Json); } catch {}

      row.evidenceStatus = result.evidenceStatus ?? "";
      row.날짜추출    = String(result.date     ?? "null");
      row.날짜성공    = result.date     ? "Y" : "N";
      row.상호명추출  = String(result.merchant ?? "null");
      row.상호명성공  = result.merchant ? "Y" : "N";
      row.금액추출    = String(result.amount   ?? "null");
      row.금액성공    = result.amount !== null && result.amount !== undefined ? "Y" : "N";
      row.품목수      = result.items?.length ?? result.itemCount ?? 0;
      row.카테고리    = String(result.categoryId ?? "null");
      row.신뢰도      = result.aiConfidence ?? 0;
      row.검토필요    = result.needsReview ? "Y" : "N";
      row.누락필드    = (result.missingFields ?? []).join("|");
      row.검토사유    = result.reviewReason ?? "";
      if (result.evidenceStatus === "ocr_failed") row.상태 = "ocr_failed";

      console.log(`✅ ${row.응답시간ms}ms | conf=${row.신뢰도} | 금액=${row.금액추출} | 상호=${row.상호명추출}`);

    } catch(e: any) {
      row.상태 = "error"; row.오류 = e.message;
      console.log(`❌ ${e.message}`);
    }

    rows.push(row);
    if (i < DATASETS.length - 1) await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
  }

  const summary = buildSummary(rows);
  console.log("\n========== 결과 요약 ==========");
  Object.entries(summary).forEach(([k,v]) => console.log(`${k.padEnd(25)}: ${v}`));
  console.log("================================");
  saveExcel(rows, summary);
}

main().catch(console.error);
