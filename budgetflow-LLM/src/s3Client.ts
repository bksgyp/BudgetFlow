// BudgetFlow LLM Service - S3 클라이언트
// 영수증 이미지를 S3에서 읽어 Base64로 반환 (Claude Vision 입력용)

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: process.env.AWS_REGION_S3 ?? "ap-northeast-2",
});

export interface S3ImageResult {
  success: true;
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export interface S3ImageFailure {
  success: false;
  error: string;
}

function guessMediaType(key: string): S3ImageResult["mediaType"] {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

export async function getImageFromS3(
  s3Key: string,
): Promise<S3ImageResult | S3ImageFailure> {
  const bucketName = process.env.S3_BUCKET_NAME ?? "2026-inha-cc-04-s3";

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const response = await client.send(command);
    if (!response.Body) {
      return { success: false, error: "S3 객체에 본문이 없습니다." };
    }

    const bytes = await response.Body.transformToByteArray();
    const base64 = Buffer.from(bytes).toString("base64");

    return {
      success: true,
      base64,
      mediaType: guessMediaType(s3Key),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[S3] 이미지 다운로드 실패:", message);
    return { success: false, error: message };
  }
}
