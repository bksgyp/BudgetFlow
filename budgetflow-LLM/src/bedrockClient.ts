// BudgetFlow LLM Service - Anthropic API 클라이언트
// Structured Output(Tool Use) 방식
//
// 모델 선정 (2026-06-20, 100개 골든셋 OCR + 12개 텍스트 케이스 + 앙상블 검증 기반):
// - 텍스트 파싱: Sonnet 채택 — 전체정확도 83.3% (Haiku/Gemini 50.0%). 앙상블은 33.3%로 오히려
//   하락(약한 모델 2곳이 우연히 같은 오답에 투표해 정답인 Sonnet을 다수결로 누름) → 미채택.
// - OCR(영수증 이미지): Haiku 채택 — 정확도 1위 + 최저비용 + 최速(Sonnet의 절반).
//   앙상블도 효과 없음(0/30 보정 사례) → 미채택.

import Anthropic from "@anthropic-ai/sdk";

const MODEL_HAIKU  = "claude-haiku-4-5-20251001";
const MODEL_SONNET = "claude-sonnet-4-5-20250929";

const TEXT_MODEL_ID   = process.env.ANTHROPIC_TEXT_MODEL   ?? MODEL_SONNET;
const VISION_MODEL_ID = process.env.ANTHROPIC_VISION_MODEL ?? MODEL_HAIKU;

const TEXT_PARSE_TOOL: Anthropic.Tool = {
  name: "extract_expense",
  description: "Extract structured expense data from Korean natural language input.",
  input_schema: {
    type: "object" as const,
    properties: {
      date:        { type: ["string", "null"], description: "YYYY-MM-DD format. null if cannot be determined." },
      amount:      { type: ["integer", "null"], description: "Integer amount in KRW. null if cannot be determined." },
      merchant:    { type: ["string", "null"], description: "Store or vendor name. null if not mentioned." },
      description: { type: "string", description: "Brief summary of the expense." },
      categoryId:  { type: ["string", "null"], description: "Must match one of the provided category IDs exactly. null if no match." },
      payerName:   { type: ["string", "null"], description: "Person who paid. null if not mentioned." },
      confidence: {
        type: "object",
        properties: {
          date:      { type: "boolean" },
          amount:    { type: "boolean" },
          category:  { type: "boolean" },
          payerName: { type: "boolean" },
        },
        required: ["date", "amount", "category", "payerName"],
      },
    },
    required: ["date", "amount", "merchant", "description", "categoryId", "payerName", "confidence"],
  },
};

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
          date:     { type: "boolean" },
          merchant: { type: "boolean" },
          amount:   { type: "boolean" },
          items:    { type: "boolean" },
          category: { type: "boolean" },
        },
        required: ["date", "merchant", "amount", "items", "category"],
      },
      rawText: { type: "string" },
    },
    required: ["date", "merchant", "amount", "description", "categoryId", "items", "confidence", "rawText"],
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
    model: TEXT_MODEL_ID,
    max_tokens: 1024,
    tools: [TEXT_PARSE_TOOL],
    tool_choice: { type: "tool", name: "extract_expense" },
    messages: [{ role: "user", content: prompt }],
  });
  return extractToolInput(message);
}

export async function callBedrockVision(
  prompt: string,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: VISION_MODEL_ID,
    max_tokens: 2048,
    tools: [OCR_TOOL],
    tool_choice: { type: "tool", name: "extract_receipt" },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: prompt },
      ],
    }],
  });
  return extractToolInput(message);
}

export const CURRENT_MODELS = { text: TEXT_MODEL_ID, vision: VISION_MODEL_ID };
export const MODELS = { HAIKU: MODEL_HAIKU, SONNET: MODEL_SONNET };
