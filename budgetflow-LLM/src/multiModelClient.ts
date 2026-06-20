// BudgetFlow LLM — 멀티모델 클라이언트
// Gemini, DeepSeek OCR 호출

import https from "https";

function parseJsonSafe(text: string): Record<string, unknown> {
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(clean);
}

export function buildOcrPromptText(categoriesText: string): string {
  return `You are a Korean receipt analysis assistant.
Analyze the receipt image and extract structured data.

Rules:
- Extract date, merchant name, total amount, and line items directly from the image.
- Do NOT guess values not visible in the image. Use null if uncertain.
- All amounts must be integers in Korean Won (KRW). Remove commas.
- Choose categoryId strictly from the provided list. Use null if no clear match.
- For rawText: transcribe all readable text line by line.

Available categories:
${categoriesText}

Return ONLY this JSON structure (no markdown, no explanation):
{
  "date": "YYYY-MM-DD or null",
  "merchant": "string or null",
  "amount": integer or null,
  "description": "string",
  "categoryId": "string or null",
  "items": [{ "name": "string", "quantity": integer or null, "unitPrice": integer or null, "amount": integer }],
  "confidence": { "date": boolean, "merchant": boolean, "amount": boolean, "items": boolean, "category": boolean },
  "rawText": "string"
}`;
}

export async function callGeminiVision(
  prompt: string,
  imageBase64: string,
  mediaType: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 없음");

  const model = "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: mediaType, data: imageBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048 },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) throw new Error(json.error.message);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          resolve(parseJsonSafe(text));
        } catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function callDeepSeekVision(
  prompt: string,
  imageBase64: string,
  mediaType: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 없음");

  const body = JSON.stringify({
    model: "deepseek-chat",
    max_tokens: 2048,
    temperature: 0,
    messages: [{
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:${mediaType};base64,${imageBase64}` }
        },
        { type: "text", text: prompt },
      ],
    }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) throw new Error(json.error.message);
          const text = json.choices?.[0]?.message?.content ?? "";
          resolve(parseJsonSafe(text));
        } catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────
// DeepSeek 텍스트 파싱
// ─────────────────────────────────────────

export async function callDeepSeekText(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 없음");

  const body = JSON.stringify({
    model: "deepseek-chat",
    max_tokens: 1024,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) throw new Error(json.error.message);
          const text = json.choices?.[0]?.message?.content ?? "";
          const clean = text.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
          resolve(JSON.parse(clean));
        } catch(e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
