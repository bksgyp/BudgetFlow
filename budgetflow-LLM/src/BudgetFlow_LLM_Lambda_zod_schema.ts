// BudgetFlow LLM Lambda - Zod 스키마
// v5: TaxOps 필드 추가 (2026-06-22)
// - taxInvoiceType, paymentMethod, businessPurpose, vatClass, vatReason
// - deductibility, taxReviewStatus, taxReviewReason, ocrQuality, ocrFailureMode, extractedTaxFields

import { z } from "zod";

// ─────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────

const EvidenceStatusSchema = z.enum([
  "none",          // 증빙 없음 (텍스트 입력)
  "uploaded",      // 파일 업로드 완료
  "ocr_completed", // OCR 호출 성공
  "ocr_failed",    // OCR 호출 실패
  "verified",      // 관리자 검증 완료
]);

export const EvidenceStatus = {
  NONE:          "none",
  UPLOADED:      "uploaded",
  OCR_COMPLETED: "ocr_completed",
  OCR_FAILED:    "ocr_failed",
  VERIFIED:      "verified",
} as const;

export const MissingFieldSchema = z.enum([
  "date", "amount", "merchant", "category", "payerName", "evidence",
]);

export const CategorySchema = z.object({
  id: z.string(), name: z.string(), keywords: z.array(z.string()),
});

const SubmittedBySchema = z.object({
  userId: z.string(), displayName: z.string(),
});

// ─────────────────────────────────────────
// TaxOps 열거형
// ─────────────────────────────────────────

// 증빙 유형 후보
export const TaxInvoiceTypeSchema = z.enum([
  "card_receipt",          // 카드전표
  "cash_receipt",          // 현금영수증
  "tax_invoice",           // 세금계산서
  "simple_receipt",        // 간이영수증 (공제 불가)
  "unknown",               // 판별 불가
]);

// 결제수단 후보
export const PaymentMethodSchema = z.enum([
  "corporate_card",  // 법인카드
  "personal_card",   // 개인카드
  "cash",            // 현금
  "transfer",        // 계좌이체
  "unknown",         // 판별 불가
]);

// 부가세 처리 후보 (확정 아닌 후보 — "공제 가능 후보" 수준)
export const VatClassSchema = z.enum([
  "vat_credit_candidate",      // 공제 가능 후보
  "vat_non_credit_candidate",  // 공제 불가 후보 (간이영수증, 면세 등)
  "needs_review",              // 판단 불가, 검토 필요
]);

// 업무 관련성 후보
export const DeductibilitySchema = z.enum([
  "likely_deductible",     // 업무 관련 가능성 높음
  "likely_non_deductible", // 개인성 지출 가능성 높음
  "unknown",               // 판단 불가
]);

// 세무 검토 상태
export const TaxReviewStatusSchema = z.enum([
  "ready",        // 주요 필드 모두 추출, 검토 불필요
  "needs_review", // 일부 필드 불확실, 검토 필요
  "blocked",      // 금액/날짜/상호 중 핵심 필드 없어 저장 불가
]);

// OCR 품질
export const OcrQualitySchema = z.enum([
  "good",   // 선명하고 인식 안정적
  "fair",   // 일부 필드 불확실
  "poor",   // 심각하게 흐리거나 잘림
]);

// OCR 실패 모드
export const OcrFailureModeSchema = z.enum([
  "none",               // 실패 없음
  "amount_missing",     // 금액 영역 인식 불가
  "date_missing",       // 날짜 인식 불가
  "merchant_missing",   // 상호 인식 불가
  "low_resolution",     // 해상도 부족
  "blurry",             // 이미지 흐림
  "partial_cut",        // 영수증 일부 잘림
  "handwritten",        // 손글씨로 인식 불안정
  "amount_mismatch",    // 합계-공급가액-부가세 불일치
  "unreadable",         // 전체적으로 판독 불가
]);

// 세무 금액 후보 필드 (영수증에서 추출된 공급가액/부가세/합계)
const ExtractedTaxFieldsSchema = z.object({
  supplyAmount: z.number().int().nonnegative().nullable(), // 공급가액
  vatAmount:    z.number().int().nonnegative().nullable(), // 부가세
  totalAmount:  z.number().int().nonnegative().nullable(), // 합계금액
}).nullable();

// ─────────────────────────────────────────
// 교차 검증 헬퍼
// ─────────────────────────────────────────

type BaseShape = {
  categoryId: string | null;
  categoryName: string | null;
  needsReview: boolean;
  reviewReason: string | null;
};

function crossFieldRefine(data: BaseShape, ctx: z.RefinementCtx) {
  if (data.categoryId === null && data.categoryName !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "categoryId가 null이면 categoryName도 null이어야 합니다.", path: ["categoryName"] });
  }
  if (!data.needsReview && data.reviewReason !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "needsReview가 false이면 reviewReason은 null이어야 합니다.", path: ["reviewReason"] });
  }
  if (data.needsReview && !data.reviewReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "needsReview가 true이면 reviewReason에 사유가 있어야 합니다.", path: ["reviewReason"] });
  }
}

// ─────────────────────────────────────────
// TaxOps 공통 출력 베이스
// ─────────────────────────────────────────

const TaxOpsFieldsSchema = z.object({
  taxInvoiceType:  TaxInvoiceTypeSchema.nullable(),
  paymentMethod:   PaymentMethodSchema.nullable(),
  businessPurpose: z.string().nullable(),        // 업무 목적 (명시된 경우만)
  vatClass:        VatClassSchema.nullable(),
  vatReason:       z.string().nullable(),         // VAT 분류 사유
  deductibility:   DeductibilitySchema.nullable(),
  taxReviewStatus: TaxReviewStatusSchema,
  taxReviewReason: z.string().nullable(),
  ocrQuality:      OcrQualitySchema.nullable(),   // 텍스트 파싱은 null
  ocrFailureMode:  OcrFailureModeSchema.nullable(),
  extractedTaxFields: ExtractedTaxFieldsSchema,  // OCR 전용, 텍스트는 null
});

// ─────────────────────────────────────────
// 공통 출력 베이스
// ─────────────────────────────────────────

const BaseOutputSchema = z.object({
  date: z.string().nullable(),
  amount: z.number().int().nonnegative().nullable(),
  merchant: z.string().nullable(),
  description: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  payerName: z.string().nullable(),
  evidenceStatus: EvidenceStatusSchema,
  evidenceFileId: z.string().nullable(),
  aiConfidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  missingFields: z.array(MissingFieldSchema),
  reviewReason: z.string().nullable(),
  reviewCode: z.string().nullable(),
});

// ─────────────────────────────────────────
// 1. 텍스트 파싱
// ─────────────────────────────────────────

export const TextParseInputSchema = z.object({
  inputType: z.literal("text"),
  text: z.string(),
  projectId: z.string(),
  requestDate: z.string(),
  timezone: z.string(),
  submittedBy: SubmittedBySchema,
  categories: z.array(CategorySchema),
});

export const TextParseOutputSchema = BaseOutputSchema
  .merge(TaxOpsFieldsSchema)
  .extend({
    inputType: z.literal("text"),
    evidenceStatus: z.literal("none"),
    evidenceFileId: z.null(),
    rawInput: z.string(),
    // 텍스트 파싱에서는 사용 안 하는 OCR 전용 필드
    ocrQuality: z.null(),
    ocrFailureMode: z.null(),
    extractedTaxFields: z.null(),
  }).superRefine(crossFieldRefine);

export type TextParseInput  = z.infer<typeof TextParseInputSchema>;
export type TextParseOutput = z.infer<typeof TextParseOutputSchema>;

// ─────────────────────────────────────────
// 2. 영수증 OCR
// ─────────────────────────────────────────

const ReceiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int().positive().nullable(),
  unitPrice: z.number().int().nonnegative().nullable(),
  amount: z.number().int().nonnegative(),
});

export const OcrInputSchema = z.object({
  inputType: z.enum(["image", "text_image"]),
  s3Key: z.string(),
  projectId: z.string(),
  evidenceFileId: z.string(),
  submittedBy: SubmittedBySchema,
  categories: z.array(CategorySchema),
});

export const OcrOutputSchema = BaseOutputSchema
  .merge(TaxOpsFieldsSchema)
  .extend({
    inputType: z.enum(["image", "text_image"]),
    payerName: z.null(),
    evidenceFileId: z.string(),
    items: z.array(ReceiptItemSchema),
    ocrRawText: z.string().nullable(),
    ocrRawTextS3Key: z.string().nullable(),
  }).superRefine(crossFieldRefine);

export type OcrInput  = z.infer<typeof OcrInputSchema>;
export type OcrOutput = z.infer<typeof OcrOutputSchema>;

// ─────────────────────────────────────────
// 유틸: 안전한 파싱
// ─────────────────────────────────────────

export function safeParseTextOutput(raw: unknown): TextParseOutput | null {
  const result = TextParseOutputSchema.safeParse(raw);
  if (result.success) return result.data;
  console.error("[TextParse] Zod 검증 실패:", result.error.issues);
  return null;
}

export function safeParseOcrOutput(raw: unknown): OcrOutput | null {
  const result = OcrOutputSchema.safeParse(raw);
  if (result.success) return result.data;
  console.error("[OCR] Zod 검증 실패:", result.error.issues);
  return null;
}
