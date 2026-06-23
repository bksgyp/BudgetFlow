# budgetflow-LLM

BudgetFlow의 LLM/OCR 서비스 컴포넌트입니다. Slack 메시지와 영수증 이미지에서 구조화된 지출 데이터를 추출합니다.

## 개요

```
Slack 메시지 / 영수증 이미지
  → 백엔드 POST /analyze/text 또는 /analyze/image
  → LLM 서비스 (이 서비스)
    - 텍스트: Claude Sonnet → 자연어에서 지출 데이터 추출
    - 이미지: S3 다운로드 → Claude Haiku(Vision) → 영수증 OCR
  → 신뢰도 계산 + needsReview 판정 + Zod 검증
  → 결과 반환
```

## 기술 스택

| 항목 | 내용 |
|---|---|
| 언어 | TypeScript 5.4 / Node.js 22 |
| 프레임워크 | Express 4.19 |
| LLM (텍스트) | Claude Sonnet (`claude-sonnet-4-5-20250929`) |
| LLM (OCR) | Claude Haiku (`claude-haiku-4-5-20251001`) |
| LLM 호출 방식 | Anthropic API 직접 호출 (`@anthropic-ai/sdk`) + Tool Use |
| 스키마 검증 | Zod 3.23 |
| 이미지 처리 | sharp 0.35 |
| 스토리지 | AWS S3 (`ap-northeast-2`) |
| 프로세스 관리 | pm2 |

> **참고**: 학교 AWS IAM 역할(`SafeRole-2026-inha-cc-04`)에 Bedrock/Textract가 explicit deny되어 있어 Anthropic API 직접 호출 방식으로 구현되었습니다.

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 아래 값을 채워주세요:

```env
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# AWS (S3 이미지 접근용)
AWS_REGION=us-east-1
AWS_REGION_S3=ap-northeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=       # AWS Academy 임시 자격증명 사용 시 필요

# S3 버킷
S3_BUCKET_NAME=2026-inha-cc-04-s3

# 서버 포트 (기본값: 4000)
PORT=4000

# 모델 오버라이드 (선택, 기본값 사용 권장)
ANTHROPIC_TEXT_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_VISION_MODEL=claude-haiku-4-5-20251001
```

### 3. 서버 실행

**개발 환경 (로컬)**:
```bash
npx tsx src/app.ts
```

**EC2 (백그라운드, pm2)**:
```bash
pm2 start
# 또는 수동으로:
nohup npx tsx src/app.ts > server.log 2>&1 &
```

### 4. 헬스체크

```bash
curl http://localhost:4000/health
# {"status":"ok","models":{"text":"claude-sonnet-4-5-20250929","vision":"claude-haiku-4-5-20251001"}}
```

---

## API

### POST `/analyze/text` — 텍스트 파싱

자연어 지출 메시지에서 구조화된 데이터를 추출합니다.

**요청 예시**:
```json
{
  "inputType": "text",
  "text": "어제 법인카드로 팀 미팅 다과 스타벅스 38000원 홍길동",
  "projectId": "proj_001",
  "requestDate": "2026-06-22",
  "timezone": "Asia/Seoul",
  "submittedBy": {
    "userId": "U12345",
    "displayName": "진수연"
  },
  "categories": [
    { "id": "cat_01", "name": "다과비", "keywords": ["간식", "음료", "카페"] },
    { "id": "cat_02", "name": "식비",   "keywords": ["식사", "밥", "점심"] }
  ]
}
```

**응답 예시**:
```json
{
  "inputType": "text",
  "date": "2026-06-21",
  "amount": 38000,
  "merchant": "스타벅스",
  "description": "팀 미팅 다과",
  "categoryId": "cat_01",
  "categoryName": "다과비",
  "categoryCandidates": null,
  "payerName": "홍길동",
  "evidenceStatus": "none",
  "evidenceFileId": null,
  "aiConfidence": 1.0,
  "needsReview": true,
  "missingFields": ["evidence"],
  "reviewReason": "증빙 없음",
  "taxInvoiceType": "card_receipt",
  "paymentMethod": "corporate_card",
  "businessPurpose": "팀 미팅 다과",
  "vatClass": "vat_credit_candidate",
  "vatReason": "법인카드 결제 및 업무 목적 명시",
  "deductibility": "likely_deductible",
  "taxReviewStatus": "ready",
  "taxReviewReason": null,
  "ocrQuality": null,
  "ocrFailureMode": null,
  "extractedTaxFields": null,
  "rawInput": "어제 법인카드로 팀 미팅 다과 스타벅스 38000원 홍길동"
}
```

---

### POST `/analyze/image` — 영수증 OCR

S3에 업로드된 영수증 이미지를 분석합니다.

**요청 예시**:
```json
{
  "inputType": "image",
  "s3Key": "receipts/2026/06/receipt_001.jpg",
  "projectId": "proj_001",
  "evidenceFileId": "evf_001",
  "submittedBy": {
    "userId": "U12345",
    "displayName": "진수연"
  },
  "categories": [
    { "id": "cat_01", "name": "다과비", "keywords": ["간식", "음료", "카페"] }
  ]
}
```

**응답 예시**:
```json
{
  "inputType": "image",
  "date": "2025-10-03",
  "merchant": "Starfield",
  "amount": 60000,
  "description": "Starfield 영수증",
  "categoryId": "cat_04",
  "categoryName": "쇼핑",
  "categoryCandidates": null,
  "payerName": null,
  "evidenceStatus": "ocr_completed",
  "evidenceFileId": "evf_001",
  "items": [
    { "name": "유니클로(과세)", "quantity": 1, "unitPrice": 60000, "amount": 60000 }
  ],
  "aiConfidence": 0.9,
  "needsReview": false,
  "missingFields": [],
  "reviewReason": null,
  "taxInvoiceType": "card_receipt",
  "paymentMethod": "personal_card",
  "businessPurpose": null,
  "vatClass": "vat_credit_candidate",
  "vatReason": "카드전표로 보이며 공급가액/부가세/합계 분리 확인",
  "deductibility": "unknown",
  "taxReviewStatus": "ready",
  "taxReviewReason": null,
  "ocrQuality": "good",
  "ocrFailureMode": "none",
  "extractedTaxFields": {
    "supplyAmount": 54546,
    "vatAmount": 5454,
    "totalAmount": 60000
  },
  "ocrRawText": "Starfield\n사업자번호: ...",
  "ocrRawTextS3Key": null
}
```

---

### GET `/health` — 헬스체크

```json
{
  "status": "ok",
  "models": {
    "text": "claude-sonnet-4-5-20250929",
    "vision": "claude-haiku-4-5-20251001"
  }
}
```

---

## 주요 설계 결정

### 모델 선정 (100개 골든셋 벤치마킹 기반)

- **텍스트 파싱 → Sonnet**: 4개 모델 비교에서 전체정확도 83.3%로 최고 (Haiku 50%, Gemini 50%, DeepSeek 58.3%)
- **OCR → Haiku**: 한국 영수증 기준 Sonnet과 동일 정확도이나 속도 2배 빠름 (4.9s vs 10.6s), 비용 절약
- **앙상블 미채택**: 텍스트 앙상블 33.3% (Sonnet 단독 83.3%보다 낮음) — 데이터로 검증 후 결정

### Structured Output (Tool Use)

"Return ONLY JSON" 방식의 파싱 실패를 막기 위해 Anthropic Tool Use 방식으로 전환. 스키마 강제로 Zod 검증 통과율 100%.

### OCR 안전장치

- **해상도 가드레일**: 가로 500px 미만 이미지는 LLM 호출 없이 차단 후 재업로드 요청 (저해상도 이미지가 신뢰도는 0.82로 높은데 금액 정확도는 0%인 위험 패턴 발견)
- **매직바이트 포맷 검증**: 파일 확장자가 아닌 실제 바이트로 JPEG/PNG/WebP/GIF 판별

### TaxOps (세무 준비 지원)

세무사가 반복적으로 하는 영수증 1차 분류 작업을 LLM이 자동화. 모든 세무 판단은 **확정이 아닌 후보**로만 반환 (`vat_credit_candidate`, `needs_review` 등).

### categoryCandidates

카테고리가 2개 이상 동일하게 매칭될 때 `categoryId: null`만 반환하는 대신, 모든 후보를 `categoryCandidates: [{id, name}]` 형태로 함께 반환. 백엔드에서 후보 목록을 활용 가능.

---

## 정확도 (최종)

### 텍스트 파싱 (100개 자동생성 검증, Sonnet)

| 필드 | 정확도 |
|---|---|
| 날짜 | 100% |
| 금액 | 100% |
| 결제자 | 100% |
| 상호명 | 91% |
| 카테고리 | 91% |
| **전체 (5필드 모두 일치)** | **82%** |

### TaxOps 텍스트 (100개 검증)

| 필드 | 정확도 |
|---|---|
| 결제수단 | 100% |
| 세무검토상태 | 96% |
| 업무목적 | 94% |
| 공제가능성 | 94% |
| **전체 (4필드 모두 일치)** | **91%** |

### OCR (한국 영수증 기준, Haiku)

| 필드 | 정확도 |
|---|---|
| 날짜 | 100% |
| 상호명 | 100% |
| 금액 | 100% |

---

## 파일 구조

```
budgetflow-LLM/
├── src/
│   ├── app.ts                            # Express 서버 (라우터, fallback 처리)
│   ├── bedrockClient.ts                  # Anthropic API 호출, Tool Use 스키마
│   ├── ocrService.ts                     # OCR 파이프라인 (S3 → Haiku → 신뢰도)
│   ├── s3Client.ts                       # S3 이미지 다운로드, 매직바이트 검증, 해상도 확인
│   ├── confidence.ts                     # 텍스트 파싱 신뢰도 계산
│   ├── promptBuilder.ts                  # 프롬프트 템플릿 치환
│   ├── BudgetFlow_LLM_Lambda_zod_schema.ts  # Zod 스키마 (입출력 타입 정의)
│   ├── multiModelClient.ts               # Gemini/DeepSeek 호출 (벤치마킹용)
│   ├── test-text-batch-100.ts            # 텍스트 100개 자동검증
│   ├── test-ocr-batch.ts                 # OCR 100개 배치 테스트
│   ├── test-taxops-text-100.ts           # TaxOps 텍스트 100개 검증
│   ├── test-taxops-ocr-20.ts             # TaxOps OCR 20개 검증
│   ├── test-noise-batch.ts               # 노이즈 강건성 테스트
│   ├── test-item-accuracy.ts             # 품목명 추출 품질 점검
│   └── test-ocr-ensemble.ts             # OCR 앙상블 검증
├── prompts/
│   ├── text_parse_prompt.txt             # 텍스트 파싱 프롬프트
│   └── ocr_vision_prompt.txt             # OCR 비전 프롬프트
├── .env.example                          # 환경변수 템플릿
├── package.json
└── tsconfig.json
```

---

## 환경변수 전체 목록

| 변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API 키 |
| `AWS_REGION` | ✅ | AWS 기본 리전 (`us-east-1`) |
| `AWS_REGION_S3` | ✅ | S3 리전 (`ap-northeast-2`) |
| `AWS_ACCESS_KEY_ID` | ✅ | AWS 자격증명 |
| `AWS_SECRET_ACCESS_KEY` | ✅ | AWS 자격증명 |
| `AWS_SESSION_TOKEN` | - | AWS Academy 임시 자격증명 사용 시 |
| `S3_BUCKET_NAME` | ✅ | S3 버킷 이름 |
| `PORT` | - | 서버 포트 (기본값: `4000`) |
| `ANTHROPIC_TEXT_MODEL` | - | 텍스트 모델 오버라이드 |
| `ANTHROPIC_VISION_MODEL` | - | 비전 모델 오버라이드 |
| `GEMINI_API_KEY` | - | Gemini API 키 (벤치마킹용) |
| `DEEPSEEK_API_KEY` | - | DeepSeek API 키 (벤치마킹용) |
