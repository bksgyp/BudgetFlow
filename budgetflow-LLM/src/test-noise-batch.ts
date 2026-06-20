// BudgetFlow 노이즈 영수증 강건성 테스트
// 한국 영수증 5장에 블러/회전/저해상도 노이즈를 합성해서
// 원본(클린) 대비 결과 일관성을 측정 — 정답 라벨이 없어 "원본 결과"를 기준값으로 사용
//
// 실행: npx tsx src/test-noise-batch.ts

import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import https from "https";
import * as XLSX from "xlsx";
import dotenv from "dotenv";
dotenv.config();

const CONFIG = {
  LLM_SERVER: "http://localhost:4000",
  S3_BUCKET: process.env.S3_BUCKET_NAME ?? "2026-inha-cc-04-s3",
  S3_PREFIX: "test/noise/",
  S3_REGION: process.env.AWS_REGION_S3 ?? "ap-northeast-2",
  DELAY_MS: 1500,
  SAMPLE_COUNT: 5,
  CATEGORIES: [
    { id: "cat_01", name: "다과비",  keywords: ["간식", "음료", "다과", "케이터링", "카페", "커피"] },
    { id: "cat_02", name: "식비",    keywords: ["식사", "밥", "점심", "저녁", "음식", "레스토랑"] },
    { id: "cat_03", name: "교통비",  keywords: ["택시", "버스", "지하철", "교통", "주유"] },
    { id: "cat_04", name: "쇼핑",    keywords: ["의류", "마트", "편의점", "쇼핑", "구매"] },
    { id: "cat_05", name: "기타",    keywords: ["기타", "잡비", "소모품"] },
  ],
};

const NOISE_TYPES = [
  { key: "clean",    label: "원본" },
  { key: "blur",     label: "블러(흔들림)" },
  { key: "rotate",   label: "회전(기울어짐)" },
  { key: "lowres",   label: "저해상도/저화질" },
  { key: "combined", label: "복합노이즈" },
] as const;

const SAMPLES = Array.from({ length: CONFIG.SAMPLE_COUNT }, (_, i) => ({
  index: i,
  apiUrl: `https://datasets-server.huggingface.co/rows?dataset=HumynLabs%2FKorean_Receipts_Dataset&config=default&split=train&offset=${i}&length=1`,
}));

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_XLSX = `noise_results_${TIMESTAMP}.xlsx`;

// ── HF 이미지 조회/다운로드 (test-ocr-batch.ts와 동일 로직) ──

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

// ── 노이즈 합성 ──

async function applyNoise(buf: Buffer, type: string): Promise<Buffer> {
  if (type === "clean") return sharp(buf).jpeg({ quality: 90 }).toBuffer();
  if (type === "blur") return sharp(buf).blur(12).jpeg({ quality: 80 }).toBuffer();
  if (type === "rotate") {
    return sharp(buf)
      .rotate(15, { background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
  if (type === "lowres") {
    const meta = await sharp(buf).metadata();
    const w = Math.max(150, Math.round((meta.width ?? 800) * 0.25));
    return sharp(buf).resize(w).jpeg({ quality: 15 }).toBuffer();
  }
  if (type === "combined") {
    const meta = await sharp(buf).metadata();
    const w = Math.max(150, Math.round((meta.width ?? 800) * 0.4));
    return sharp(buf)
      .rotate(10, { background: { r: 255, g: 255, b: 255 } })
      .blur(6)
      .resize(w)
      .jpeg({ quality: 20 })
      .toBuffer();
  }
  return buf;
}

// ── S3 ──

const s3 = new S3Client({ region: CONFIG.S3_REGION });

async function uploadImageToS3(buf: Buffer, key: string) {
  await s3.send(new PutObjectCommand({
    Bucket: CONFIG.S3_BUCKET, Key: key, Body: buf, ContentType: "image/jpeg",
  }));
}

// ── LLM 호출 ──

async function callClaudeServer(s3Key: string, evidenceFileId: string) {
  const res = await fetch(`${CONFIG.LLM_SERVER}/analyze/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputType: "image", s3Key, projectId: "test_noise", evidenceFileId,
      submittedBy: { userId: "U_TEST", displayName: "노이즈테스트" },
      categories: CONFIG.CATEGORIES,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

// ── 엑셀 저장 ──

function saveExcel(rows: any[], summary: any[]) {
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = Object.keys(rows[0]||{}).map(k=>({wch:Math.max(k.length,14)}));
  XLSX.utils.book_append_sheet(wb, ws1, "상세결과");
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = Object.keys(summary[0]||{}).map(k=>({wch:Math.max(k.length,18)}));
  XLSX.utils.book_append_sheet(wb, ws2, "노이즈별 요약");
  XLSX.writeFile(wb, OUTPUT_XLSX);
  console.log(`\n📊 엑셀 저장: ${OUTPUT_XLSX}`);
}

// ── 메인 ──

async function main() {
  console.log(`\n[노이즈 강건성 테스트] 한국 영수증 ${CONFIG.SAMPLE_COUNT}장 × 노이즈 ${NOISE_TYPES.length}종\n`);
  const rows: any[] = [];
  const baselines: Record<number, any> = {};

  for (const sample of SAMPLES) {
    process.stdout.write(`[샘플 ${sample.index + 1}/${CONFIG.SAMPLE_COUNT}] 원본 URL 조회 → `);
    let imgUrl: string;
    try { imgUrl = await fetchHFImageUrl(sample.apiUrl); }
    catch(e: any) { console.log(`❌ ${e.message} (건너뜀)`); continue; }

    let originalBuf: Buffer;
    try { originalBuf = await downloadImage(imgUrl); }
    catch(e: any) { console.log(`❌ ${e.message} (건너뜀)`); continue; }
    console.log("✅");

    for (const noise of NOISE_TYPES) {
      const s3Key = `${CONFIG.S3_PREFIX}sample${sample.index+1}_${noise.key}.jpg`;
      const evfId = `evf_noise_${sample.index+1}_${noise.key}`;
      const row: any = {
        샘플: sample.index + 1, 노이즈타입: noise.label,
        상태: "success", 날짜: "null", 상호명: "null", 금액: "null",
        날짜일치: "-", 상호명일치: "-", 금액일치: "-",
        신뢰도: 0, 검토필요: "N", 응답시간ms: 0, 오류: "",
      };

      process.stdout.write(`  └ ${noise.label} → `);
      try {
        const noisyBuf = await applyNoise(originalBuf, noise.key);
        await uploadImageToS3(noisyBuf, s3Key);

        const t0 = Date.now();
        const result = await callClaudeServer(s3Key, evfId);
        row.응답시간ms = Date.now() - t0;

        row.날짜 = String(result.date ?? "null");
        row.상호명 = String(result.merchant ?? "null");
        row.금액 = String(result.amount ?? "null");
        row.신뢰도 = result.aiConfidence ?? 0;
        row.검토필요 = result.needsReview ? "Y" : "N";

        if (noise.key === "clean") {
          baselines[sample.index] = { date: result.date, merchant: result.merchant, amount: result.amount };
          row.날짜일치 = "기준값"; row.상호명일치 = "기준값"; row.금액일치 = "기준값";
        } else {
          const base = baselines[sample.index];
          row.날짜일치   = base ? (result.date === base.date ? "Y" : "N") : "?";
          row.상호명일치 = base ? (result.merchant === base.merchant ? "Y" : "N") : "?";
          row.금액일치   = base ? (result.amount === base.amount ? "Y" : "N") : "?";
        }

        console.log(`✅ ${row.응답시간ms}ms | 신뢰도=${row.신뢰도} | 날짜=${row.날짜} | 금액=${row.금액}`);
      } catch(e: any) {
        row.상태 = "error"; row.오류 = e.message;
        console.log(`❌ ${e.message}`);
      }

      rows.push(row);
      await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
    }
  }

  const summary = NOISE_TYPES.map(noise => {
    const group = rows.filter(r => r.노이즈타입 === noise.label && r.상태 === "success");
    const matchRate = (field: string) => {
      const withBase = group.filter(r => r[field] === "Y" || r[field] === "N");
      if (withBase.length === 0) return "-";
      const ok = withBase.filter(r => r[field] === "Y").length;
      return `${((ok/withBase.length)*100).toFixed(1)}%`;
    };
    return {
      노이즈타입: noise.label,
      샘플수: group.length,
      날짜일치율: matchRate("날짜일치"),
      상호명일치율: matchRate("상호명일치"),
      금액일치율: matchRate("금액일치"),
      평균신뢰도: group.length ? (group.reduce((s,r)=>s+r.신뢰도,0)/group.length).toFixed(3) : "N/A",
      검토필요비율: group.length ? `${group.filter(r=>r.검토필요==="Y").length}/${group.length}` : "N/A",
    };
  });

  console.log("\n========== 노이즈별 요약 ==========");
  summary.forEach(s => console.log(JSON.stringify(s)));
  console.log("====================================");

  saveExcel(rows, summary);
}

main().catch(console.error);
