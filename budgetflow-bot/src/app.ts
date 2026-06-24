import { App } from '@slack/bolt';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
dotenv.config();

//환경변수 필수값 검증증
const REQUIRED_ENVS = [
  'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN',
  'BACKEND_URL',
  'PROJECT_ID',
  'AWS_REGION',
  'S3_BUCKET_NAME',
];

for (const key of REQUIRED_ENVS) {
  if (!process.env[key]) {
    throw new Error(`필수 환경변수 누락: ${key}`);
  }
}

const BACKEND_URL = process.env.BACKEND_URL!.replace(/\/$/, '');
const PROJECT_ID = process.env.PROJECT_ID!;

const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  appToken: process.env.SLACK_APP_TOKEN!,
  socketMode: true,
});

// EC2 IAM Role로 자동 인증 (Access Key 불필요)
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
});

// 슬랙에서 사용자 이름 가져오기
async function getSlackUserName(client: any, userId: string): Promise<string> {
  try {
    const result = await client.users.info({ user: userId });
    return result.user.real_name || result.user.name || userId;
  } catch {
    return userId;
  }
}

// 슬랙에서 이미지 다운로드
async function downloadImage(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
}

// S3에 업로드 후 URL 반환
async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const safeFileName = fileName.replace(/[^\w.\-가-힣]/g, '_');
  const key = `receipts/${Date.now()}_${safeFileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

// 백엔드에 전달
async function sendToBackend(payload: object) {
  const response = await axios.post(
    `${BACKEND_URL}/api/expenses`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-BudgetFlow-Bot-Secret': process.env.BOT_API_SECRET ?? '',
      },
      timeout: 15000,
    }
  );

  return response.data;
}

// 결과 메시지 전송
async function sendResultMessage(client: any, channel: string, result: any) {
  if (result.action === 'request_re_input') {
    await client.chat.postMessage({
      channel,
      text: `⚠️ ${result.reviewReason || '금액 정보를 찾을 수 없습니다. 다시 입력해주세요.'}`,
    });
  } else if (result.status === 'needs_review') {
    await client.chat.postMessage({
      channel,
      text: `⚠️ 검토가 필요한 항목이 있습니다.\n사유: ${result.review_reason || '확인 필요'}`,
    });
  } else {
    await client.chat.postMessage({
      channel,
      text: `✅ 등록됐습니다!\n날짜: ${result.date}\n금액: ${result.amount}원\n항목: ${result.description}`,
    });
  }
}

app.event('message', async ({ event, client }) => {
  // 봇 자신의 메시지는 무시
  if ('bot_id' in event) return;

  const msg = event as any;
  const text = msg.text || '';
  const files = msg.files || [];

  const hasText = text.trim().length > 0;
  const hasImage = files.some((f: any) => f.mimetype?.startsWith('image/'));

  // 텍스트, 이미지도 둘 다 없는 메세지 무시
  if (!hasText && !hasImage) {
    return;
  }

  // 접수 확인 메시지 전송
  await client.chat.postMessage({
    channel: msg.channel,
    text: '✅ 접수됐습니다. 분석 중...',
  });

  try {
    let s3Url: string | null = null;

    // 이미지가 있으면 다운로드 후 S3 업로드
    if (hasImage) {
      const file = files.find((f: any) => f.mimetype?.startsWith('image/'));
    
      if (!file?.url_private) {
        await client.chat.postMessage({
          channel: msg.channel,
          text: '❌ 이미지 파일 정보를 가져오지 못했습니다.',
        });
        return;
      }
    
      try {
        const imageBuffer = await downloadImage(file.url_private);
        s3Url = await uploadToS3(imageBuffer, file.name, file.mimetype);
        console.log('S3 업로드 완료:', s3Url);
      } catch (error) {
        console.error('S3 업로드 실패:', error);
        await client.chat.postMessage({
          channel: msg.channel,
          text: '❌ 영수증 이미지 업로드 중 오류가 발생했습니다.',
        });
        return;
      }
    }
    
    if (hasImage && !s3Url) {
      await client.chat.postMessage({
        channel: msg.channel,
        text: '❌ 영수증 이미지 처리에 실패했습니다.',
      });
      return;
    }
    // 슬랙 사용자 이름 가져오기
    const displayName = await getSlackUserName(client, msg.user);

    // 페이로드 구성
    const payload: any = {
      slackUserId: msg.user,
      channelId: msg.channel,
      projectId: PROJECT_ID,
      type: hasImage && hasText ? 'text_image' : hasImage ? 'image' : 'text',
      submittedBy: {
        userId: msg.user,
        displayName: displayName,
      },
      categories: [],
    };

    if (hasText) payload.text = text;
    if (s3Url) payload.imageUrl = s3Url;

    // 백엔드 호출
    const result = await sendToBackend(payload);
    console.log('백엔드 응답:', result);

    await sendResultMessage(client, msg.channel, result);

  } catch (error) {
    console.error('처리 중 오류:', error);
    await client.chat.postMessage({
      channel: msg.channel,
      text: '❌ 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
    });
  }
});

(async () => {
  await app.start();
  console.log('봇 실행 중!');
})();
