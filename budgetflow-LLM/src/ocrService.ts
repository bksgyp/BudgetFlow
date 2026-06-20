// BudgetFlow LLM Service - OCR 서비스
// (변경) Textract 권한 이슈로 Claude Vision 직접 분석 방식으로 전환
// (변경, 2026-06-20) 이미지 해상도 가드레일 추가 — 노이즈 강건성 테스트에서
//   저해상도 이미지가 신뢰도는 높게(0.82) 나오면서 실제 금액 추출은 0%로 틀리는
//   위험 패턴을 확인함. 가로 500px 미만이면 LLM 호출 없이 재업로드 요청으로 처리.

import { getImageFromS3 } from "./s3Client";
import { buildOcrVisionPrompt } from "./promptBuilder";
import { callBedrockVision } from "./bedrockClient";
import {
  EvidenceStatus,
  MissingFieldSchema,
} from "./BudgetFlow_LLM_Lambda_zod_schema";
import type { OcrInput, OcrOutput } from "./BudgetFlow_LLM_Lambda_zod_schema";
import { z } from "zod";

type MissingField = z.infer<typeof MissingFieldSchema>;

const CONFIDENCE_THRESHOLD = 0.7;
const OCR_RAW_TEXT_SIZE_LIMIT = 10 * 1024;
const MIN_IMAGE_WIDTH = 500; // 노이즈 테스트(2026-06-20) 기준 — 이 미만은 재업로드 요청

interface LLMOcrRaw {
  date: string | null;
  merchant: string | null;
  amount: number | null;
  description: string;
  categoryId: string | null;
  items: Array<{
    name: string;
    quantity: number | null;
    unitPrice: number | null;
    amount: number;
  }>;
  confidence: {
    date: boolean;
    merchant: boolean;
    amount: boolean;
    items: boolean;
    category: boolean;
  };
  rawText: string;
}

interface OcrConfidenceResult {
  aiConfidence: number;
  missingFields: MissingField[];
  needsReview: boolean;
  reviewReason: string | null;
}

function calcOcrConfidence(llm: LLMOcrRaw): OcrConfidenceResult {
  const { confidence } = llm;

  let score =
    (confidence.date ? 0.2 : 0) +
    (confidence.merchant ? 0.2 : 0) +
    (confidence.amount ? 0.3 : 0) +
    (confidence.items ? 0.2 : 0) +
    (confidence.category ? 0.1 : 0);

  if (!confidence.items) {
    score = Math.min(score, 0.8);
  }

  const aiConfidence = Math.round(score * 10) / 10;

  const missingFields: MissingField[] = [];
  if (!confidence.date) missingFields.push("date");
  if (!llm.merchant) missingFields.push("merchant");
  if (!confidence.amount) missingFields.push("amount");
  if (!confidence.category) missingFields.push("category");

  const reasons: string[] = [];

  if (aiConfidence < CONFIDENCE_THRESHOLD)
    reasons.push(`신뢰도 낮음 (${aiConfidence})`);
  if (!confidence.amount) reasons.push("금액 미확인");
  if (!confidence.date) reasons.push("사용일 미확인");
  if (!llm.merchant) reasons.push("사용처 미확인");
  if (!confidence.category) reasons.push("카테고리 분류 실패");

  if (llm.amount && llm.items.length > 0) {
    const itemsTotal = llm.items.reduce((sum, item) => sum + item.amount, 0);
    const diff = Math.abs(itemsTotal - llm.amount) / llm.amount;
    if (diff > 0.05) {
      reasons.push(
        `품목 합계(${itemsTotal}원)와 영수증 합계(${llm.amount}원) 불일치`,
      );
    }
  }

  const needsReview = reasons.length > 0;
  const reviewReason = needsReview ? reasons.join(", ") : null;

  return { aiConfidence, missingFields, needsReview, reviewReason };
}

function buildDescription(
  merchant: string | null,
  date: string | null,
): string {
  if (merchant) return `${merchant} 영수증`;
  if (date) return `영수증 ${date}`;
  return "영수증";
}

function handleRawText(rawText: string): {
  ocrRawText: string | null;
  ocrRawTextS3Key: string | null;
} {
  const byteSize = Buffer.byteLength(rawText, "utf-8");
  if (byteSize <= OCR_RAW_TEXT_SIZE_LIMIT) {
    return { ocrRawText: rawText, ocrRawTextS3Key: null };
  }
  console.warn(`[OCR] ocrRawText ${byteSize}bytes > 10KB 초과 → S3 분리 필요`);
  return { ocrRawText: null, ocrRawTextS3Key: "PENDING" };
}

function ocrFailureOutput(input: OcrInput, reason: string): OcrOutput {
  return {
    inputType: input.inputType,
    date: null,
    merchant: null,
    amount: null,
    description: "영수증",
    categoryId: null,
    categoryName: null,
    payerName: null,
    evidenceStatus: EvidenceStatus.OCR_FAILED,
    evidenceFileId: input.evidenceFileId,
    items: [],
    aiConfidence: 0.0,
    needsReview: true,
    missingFields: ["date", "merchant", "amount", "category"],
    reviewReason: reason,
    reviewCode: null,
    ocrRawText: "",
    ocrRawTextS3Key: null,
  };
}

export async function runOcrPipeline(input: OcrInput): Promise<OcrOutput> {
  const imageResult = await getImageFromS3(input.s3Key);

  if (!imageResult.success) {
    console.error("[OCR] S3 이미지 다운로드 실패:", imageResult.error);
    return ocrFailureOutput(input, "이미지 다운로드 실패");
  }

  if (imageResult.width !== null && imageResult.width < MIN_IMAGE_WIDTH) {
    console.warn(
      `[OCR] 이미지 해상도 낮음 (${imageResult.width}px < ${MIN_IMAGE_WIDTH}px) → LLM 호출 생략, 재업로드 요청`,
    );
    return ocrFailureOutput(
      input,
      `이미지 해상도가 너무 낮습니다 (가로 ${imageResult.width}px). 더 선명한 사진으로 다시 업로드해주세요.`,
    );
  }

  let llmRaw: LLMOcrRaw;
  try {
    const prompt = buildOcrVisionPrompt({ categories: input.categories });
    llmRaw = (await callBedrockVision(
      prompt,
      imageResult.base64,
      imageResult.mediaType,
    )) as unknown as LLMOcrRaw;
  } catch (err) {
    console.error("[OCR] Claude Vision 호출 실패:", err);
    return ocrFailureOutput(input, "OCR 분석 실패");
  }

  if (!llmRaw.rawText || llmRaw.rawText.trim().length < 5) {
    console.warn("[OCR] rawText 너무 짧음 → OCR 실패 처리");
    return ocrFailureOutput(input, "OCR 인식 결과 없음");
  }

  const { aiConfidence, missingFields, needsReview, reviewReason } =
    calcOcrConfidence(llmRaw);

  const finalNeedsReview = needsReview || llmRaw.amount === null;
  const finalReviewReason =
    llmRaw.amount === null && !needsReview ? "금액 미확인" : reviewReason;

  const categoryName = llmRaw.categoryId
    ? (input.categories.find((c) => c.id === llmRaw.categoryId)?.name ?? null)
    : null;

  const { ocrRawText, ocrRawTextS3Key } = handleRawText(llmRaw.rawText);

  const output: OcrOutput = {
    inputType: input.inputType,
    date: llmRaw.date,
    merchant: llmRaw.merchant,
    amount: llmRaw.amount,
    description:
      llmRaw.description || buildDescription(llmRaw.merchant, llmRaw.date),
    categoryId: llmRaw.categoryId,
    categoryName,
    payerName: null,
    evidenceStatus: EvidenceStatus.OCR_COMPLETED,
    evidenceFileId: input.evidenceFileId,
    items: llmRaw.items,
    aiConfidence,
    needsReview: finalNeedsReview,
    missingFields,
    reviewReason: finalReviewReason,
    reviewCode: null,
    ocrRawText,
    ocrRawTextS3Key,
  };

  return output;
}
