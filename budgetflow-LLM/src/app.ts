// BudgetFlow LLM Service - Express 서버
// 백엔드 Express → POST /analyze/text, POST /analyze/image 호출로 LLM 분석 수행
// v2: TaxOps 필드 추가 (2026-06-22)

import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { callBedrock, CURRENT_MODELS } from "./bedrockClient";
import { buildTextParsePrompt } from "./promptBuilder";
import { calcTextParseConfidence, shouldRequestReInput } from "./confidence";
import { runOcrPipeline } from "./ocrService";
import {
  TextParseInputSchema,
  TextParseOutputSchema,
  OcrInputSchema,
  EvidenceStatus,
} from "./BudgetFlow_LLM_Lambda_zod_schema";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 4000;

// TaxOps 기본값 (텍스트 fallback용 — 분석 실패 시)
const TAX_OPS_TEXT_DEFAULTS = {
  taxInvoiceType:  null,
  paymentMethod:   null,
  businessPurpose: null,
  vatClass:        null,
  vatReason:       null,
  deductibility:   null,
  taxReviewStatus: "blocked" as const,
  taxReviewReason: null,
  ocrQuality:      null,
  ocrFailureMode:  null,
  extractedTaxFields: null,
};

// TaxOps 기본값 (OCR fallback용 — 분석 실패 시)
const TAX_OPS_OCR_DEFAULTS = {
  taxInvoiceType:  null,
  paymentMethod:   null,
  businessPurpose: null,
  vatClass:        null,
  vatReason:       null,
  deductibility:   null,
  taxReviewStatus: "blocked" as const,
  taxReviewReason: null,
  ocrQuality:      "poor" as const,
  ocrFailureMode:  "unreadable" as const,
  extractedTaxFields: null,
};

// ─────────────────────────────────────────
// POST /analyze/text — 텍스트 파싱
// ─────────────────────────────────────────

app.post("/analyze/text", async (req: Request, res: Response) => {
  // 1. 입력 검증
  const inputResult = TextParseInputSchema.safeParse(req.body);
  if (!inputResult.success) {
    return res.status(400).json({
      error: "입력 데이터 검증 실패",
      details: inputResult.error.issues,
    });
  }

  const input = inputResult.data;
  let llmRaw: Record<string, unknown>;

  try {
    // 2. 프롬프트 생성
    const prompt = buildTextParsePrompt({
      text: input.text,
      requestDate: input.requestDate,
      timezone: input.timezone,
      submittedBy: input.submittedBy,
      categories: input.categories,
    });

    // 3. Bedrock 호출
    llmRaw = await callBedrock(prompt);

  } catch (err) {
    console.error("[TextParse] Bedrock 호출 실패:", err);
    return res.status(200).json(
      textFallbackOutput(input.text, "Bedrock 호출 실패")
    );
  }

  // 4. amount null → 재입력 요청
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (shouldRequestReInput(llmRaw as any)) {
    console.log("[TextParse] amount null → 재입력 요청:", input.text);
    return res.status(200).json({
      action: "request_re_input",
      userId: input.submittedBy.userId,
      rawInput: input.text,
    });
  }

  // 5. 신뢰도 계산
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confidenceResult = calcTextParseConfidence(llmRaw as any);

  // 6. 최종 출력 조립 (TaxOps 필드 포함)
  const output = {
    inputType:      "text" as const,
    date:           llmRaw.date ?? null,
    amount:         llmRaw.amount ?? null,
    merchant:       llmRaw.merchant ?? null,
    description:    (llmRaw.description as string) || input.text,
    categoryId:     llmRaw.categoryId ?? null,
    categoryName:   llmRaw.categoryName ?? null,
    payerName:      llmRaw.payerName ?? null,
    evidenceStatus: EvidenceStatus.NONE,
    evidenceFileId: null,
    aiConfidence:   confidenceResult.aiConfidence,
    needsReview:    confidenceResult.needsReview,
    missingFields:  confidenceResult.missingFields,
    reviewReason:   confidenceResult.reviewReason,
    reviewCode:     null,
    rawInput:       input.text,
    // TaxOps
    taxInvoiceType:     (llmRaw.taxInvoiceType  ?? null) as any,
    paymentMethod:      (llmRaw.paymentMethod   ?? null) as any,
    businessPurpose:    (llmRaw.businessPurpose ?? null) as string | null,
    vatClass:           (llmRaw.vatClass        ?? null) as any,
    vatReason:          (llmRaw.vatReason       ?? null) as string | null,
    deductibility:      (llmRaw.deductibility   ?? null) as any,
    taxReviewStatus:    ((llmRaw.taxReviewStatus as string) ?? "needs_review") as any,
    taxReviewReason:    (llmRaw.taxReviewReason ?? null) as string | null,
    ocrQuality:         null,
    ocrFailureMode:     null,
    extractedTaxFields: null,
  };

  // 7. Zod 검증
  const outputResult = TextParseOutputSchema.safeParse(output);
  if (!outputResult.success) {
    console.error("[TextParse] Zod 검증 실패:", outputResult.error.issues);
    return res.status(200).json(
      textFallbackOutput(input.text, "LLM 출력 검증 실패")
    );
  }

  return res.status(200).json(outputResult.data);
});

// ─────────────────────────────────────────
// POST /analyze/image — 영수증 OCR
// ─────────────────────────────────────────

app.post("/analyze/image", async (req: Request, res: Response) => {
  // 1. 입력 검증
  const inputResult = OcrInputSchema.safeParse(req.body);
  if (!inputResult.success) {
    return res.status(400).json({
      error: "입력 데이터 검증 실패",
      details: inputResult.error.issues,
    });
  }

  const input = inputResult.data;

  try {
    // 2. OCR 파이프라인 실행
    const output = await runOcrPipeline(input);
    return res.status(200).json(output);

  } catch (err) {
    console.error("[OCR] 파이프라인 실패:", err);
    return res.status(200).json(
      ocrFallbackOutput(input.inputType, input.evidenceFileId, "OCR 파이프라인 실패")
    );
  }
});

// ─────────────────────────────────────────
// GET /health — 헬스체크
// ─────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", models: CURRENT_MODELS });
});

// ─────────────────────────────────────────
// Fallback 출력
// ─────────────────────────────────────────

function textFallbackOutput(rawInput: string, reason: string) {
  return {
    inputType:      "text",
    date:           null,
    amount:         null,
    merchant:       null,
    description:    rawInput || "분석 실패",
    categoryId:     null,
    categoryName:   null,
    payerName:      null,
    evidenceStatus: EvidenceStatus.NONE,
    evidenceFileId: null,
    aiConfidence:   0.0,
    needsReview:    true,
    missingFields:  ["date", "amount", "merchant", "category", "payerName", "evidence"],
    reviewReason:   reason,
    reviewCode:     null,
    rawInput,
    ...TAX_OPS_TEXT_DEFAULTS,
  };
}

function ocrFallbackOutput(
  inputType: "image" | "text_image",
  evidenceFileId: string,
  reason: string
) {
  return {
    inputType,
    date:            null,
    merchant:        null,
    amount:          null,
    description:     "영수증",
    categoryId:      null,
    categoryName:    null,
    payerName:       null,
    evidenceStatus:  EvidenceStatus.OCR_FAILED,
    evidenceFileId,
    items:           [],
    aiConfidence:    0.0,
    needsReview:     true,
    missingFields:   ["date", "merchant", "amount", "category"],
    reviewReason:    reason,
    reviewCode:      null,
    ocrRawText:      "",
    ocrRawTextS3Key: null,
    ...TAX_OPS_OCR_DEFAULTS,
  };
}

app.listen(PORT, () => {
  console.log(`[BudgetFlow LLM] 서버 시작 포트 ${PORT}`);
});

export default app;
