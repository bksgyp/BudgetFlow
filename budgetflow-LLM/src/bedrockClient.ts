// BudgetFlow LLM Service - Anthropic API 클라이언트
// v2: TaxOps 필드 추가 (2026-06-22)

import Anthropic from "@anthropic-ai/sdk";

const MODEL_HAIKU  = "claude-haiku-4-5-20251001";
const MODEL_SONNET = "claude-sonnet-4-5-20250929";

const TEXT_MODEL_ID   = process.env.ANTHROPIC_TEXT_MODEL   ?? MODEL_SONNET;
const VISION_MODEL_ID = process.env.ANTHROPIC_VISION_MODEL ?? MODEL_HAIKU;

// TaxOps 공통 Tool Use 프로퍼티
const TAX_OPS_PROPERTIES = {
  taxInvoiceType: {
    type: ["string", "null"],
    enum: ["card_receipt", "cash_receipt", "tax_invoice", "simple_receipt", "unknown", null],
    description: "증빙 유형 후보. 확정 아님. 판별 불가 시 'unknown'.",
  },
  paymentMethod: {
    type: ["string", "null"],
    enum: ["corporate_card", "personal_card", "cash", "transfer", "unknown", null],
    description: "결제수단 후보. 카드번호 보이면 개인/법인 구분, 불명확하면 'unknown'.",
  },
  businessPurpose: {
    type: ["string", "null"],
    description: "영수증/입력에 명시된 업무 목적. 없으면 null.",
  },
  vatClass: {
    type: ["string", "null"],
    enum: ["vat_credit_candidate", "vat_non_credit_candidate", "needs_review", null],
    description: "VAT 공제 후보 분류. 세금계산서/카드전표 → vat_credit_candidate, 간이영수증 → vat_non_credit_candidate, 불명확 → needs_review.",
  },
  vatReason: {
    type: ["string", "null"],
    description: "vatClass 분류 사유. 예: '카드전표로 보이나 업무 목적 누락'.",
  },
  deductibility: {
    type: ["string", "null"],
    enum: ["likely_deductible", "likely_non_deductible", "unknown", null],
    description: "업무 관련성 후보. 확정 아님. 업무 목적 명시 시 likely_deductible.",
  },
  taxReviewStatus: {
    type: "string",
    enum: ["ready", "needs_review", "blocked"],
    description: "ready: 핵심 필드 모두 추출. needs_review: 일부 불확실. blocked: 금액/날짜/상호 중 하나라도 없음.",
  },
  taxReviewReason: {
    type: ["string", "null"],
    description: "taxReviewStatus가 needs_review/blocked일 때 사람이 읽을 수 있는 사유.",
  },
};

const TEXT_PARSE_TOOL: Anthropic.Tool = {
  name: "extract_expense",
  description: "Extract structured expense data from Korean natural language input.",
  input_schema: {
    type: "object" as const,
    properties: {
      date:        { type: ["string", "null"], description: "YYYY-MM-DD. null if cannot be determined." },
      amount:      { type: ["integer", "null"], description: "Integer KRW. null if cannot be determined." },
      merchant:    { type: ["string", "null"], description: "Store/vendor name. null if not mentioned." },
      description: { type: "string", description: "Brief summary of the expense." },
      categoryId:  { type: ["string", "null"], description: "Must match provided category IDs. null if no match or ambiguous." },
      categoryCandidates: { type: ["array", "null"], items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] }, description: "When 2+ categories match equally, list ALL candidates here and set categoryId to null." },
      payerName:   { type: ["string", "null"], description: "Person who paid. null if not explicitly mentioned." },
      confidence: {
        type: "object",
        properties: {
          date: { type: "boolean" }, amount: { type: "boolean" },
          category: { type: "boolean" }, payerName: { type: "boolean" },
        },
        required: ["date", "amount", "category", "payerName"],
      },
      ...TAX_OPS_PROPERTIES,
    },
    required: ["date", "amount", "merchant", "description", "categoryId", "categoryCandidates", "payerName", "confidence",
               "taxInvoiceType", "paymentMethod", "businessPurpose", "vatClass", "vatReason",
               "deductibility", "taxReviewStatus", "taxReviewReason"],
  },
};

const OCR_TOOL: Anthropic.Tool = {
  name: "extract_receipt",
  description: "Extract structured expense and tax data from a Korean receipt image.",
  input_schema: {
    type: "object" as const,
    properties: {
      date:        { type: ["string", "null"], description: "YYYY-MM-DD from receipt. null if not visible." },
      merchant:    { type: ["string", "null"], description: "Store name as printed. null if not visible." },
      amount:      { type: ["integer", "null"], description: "Total payment as integer KRW. null if not found." },
      description: { type: "string", description: "Auto-generated description." },
      categoryId:  { type: ["string", "null"], description: "Must match provided category IDs. null if no match or ambiguous." },
      categoryCandidates: { type: ["array", "null"], items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] }, description: "When 2+ categories match equally, list ALL candidates here and set categoryId to null." },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" }, quantity: { type: ["integer", "null"] },
            unitPrice: { type: ["integer", "null"] }, amount: { type: "integer" },
          },
          required: ["name", "quantity", "unitPrice", "amount"],
        },
      },
      confidence: {
        type: "object",
        properties: {
          date: { type: "boolean" }, merchant: { type: "boolean" },
          amount: { type: "boolean" }, items: { type: "boolean" }, category: { type: "boolean" },
        },
        required: ["date", "merchant", "amount", "items", "category"],
      },
      rawText: { type: "string", description: "All readable text from receipt, line by line." },
      ...TAX_OPS_PROPERTIES,
      ocrQuality: {
        type: "string",
        enum: ["good", "fair", "poor"],
        description: "good: 선명하고 안정적. fair: 일부 불확실. poor: 심각하게 흐리거나 잘림.",
      },
      ocrFailureMode: {
        type: "string",
        enum: ["none", "amount_missing", "date_missing", "merchant_missing",
               "low_resolution", "blurry", "partial_cut", "handwritten", "amount_mismatch", "unreadable"],
        description: "none이면 실패 없음. 복수 원인이면 가장 심각한 것 하나만.",
      },
      extractedTaxFields: {
        type: ["object", "null"],
        properties: {
          supplyAmount: { type: ["integer", "null"], description: "공급가액" },
          vatAmount:    { type: ["integer", "null"], description: "부가세" },
          totalAmount:  { type: ["integer", "null"], description: "합계금액" },
        },
        description: "영수증에 공급가액/부가세/합계가 분리돼 있을 때 추출. 없으면 null.",
      },
    },
    required: ["date", "merchant", "amount", "description", "categoryId", "categoryCandidates", "items", "confidence", "rawText",
               "taxInvoiceType", "paymentMethod", "businessPurpose", "vatClass", "vatReason",
               "deductibility", "taxReviewStatus", "taxReviewReason",
               "ocrQuality", "ocrFailureMode", "extractedTaxFields"],
  },
};

function extractToolInput(message: Anthropic.Message): Record<string, unknown> {
  const toolUse = message.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!toolUse) throw new Error("Tool Use 응답 없음");
  return toolUse.input as Record<string, unknown>;
}

export async function callBedrock(prompt: string): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: TEXT_MODEL_ID, max_tokens: 1024, temperature: 0,
    tools: [TEXT_PARSE_TOOL], tool_choice: { type: "tool", name: "extract_expense" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractToolInput(message);
}

export async function callBedrockVision(
  prompt: string, imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: VISION_MODEL_ID, max_tokens: 2048, temperature: 0,
    tools: [OCR_TOOL], tool_choice: { type: "tool", name: "extract_receipt" },
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
      { type: "text", text: prompt },
    ]}],
  });
  return extractToolInput(message);
}

export const CURRENT_MODELS = { text: TEXT_MODEL_ID, vision: VISION_MODEL_ID };
export const MODELS = { HAIKU: MODEL_HAIKU, SONNET: MODEL_SONNET };
