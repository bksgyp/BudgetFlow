// BudgetFlow LLM Service - S3 클라이언트
// 영수증 이미지를 S3에서 읽어 Base64로 반환 (Claude Vision 입력용)
// + 이미지 width/height도 함께 반환 (해상도 가드레일용, 2026-06-20 추가)
// + 실제 이미지 바이트(매직바이트)로 포맷 확인, 확장자는 폴백으로만 사용
//   (CORD 데이터셋 테스트 중 PNG를 jpeg로 잘못 보내 400 에러 났던 버그를
//    프로덕션 코드에도 동일하게 적용해 예방)

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const client = new S3Client({
  region: process.env.AWS_REGION_S3 ?? "ap-northeast-2",
});

export interface S3ImageResult {
  success: true;
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  width: number | null;
  height: number | null;
}

export interface S3ImageFailure {
  success: false;
  error: string;
}

function guessMediaTypeFromExtension(key: string): S3ImageResult["mediaType"] {
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

// 매직바이트로 실제 이미지 포맷 확인 (확장자가 틀려도 정확히 판별)
function detectMediaTypeFromBytes(buf: Buffer): S3ImageResult["mediaType"] | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
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
    const buf = Buffer.from(bytes);
    const base64 = buf.toString("base64");

    const mediaType =
      detectMediaTypeFromBytes(buf) ?? guessMediaTypeFromExtension(s3Key);

    let width: number | null = null;
    let height: number | null = null;
    try {
      const meta = await sharp(buf).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch (e) {
      console.warn("[S3] 이미지 크기 확인 실패 (해상도 체크는 건너뜀):", e);
    }

    return {
      success: true,
      base64,
      mediaType,
      width,
      height,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[S3] 이미지 다운로드 실패:", message);
    return { success: false, error: message };
  }
}
