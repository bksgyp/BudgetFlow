# BudgetFlow

> 슬랙에 영수증과 지출 설명을 보내면 AI가 자동 분석하고, 관리자가 검토 후 제출용 엑셀을 내려받는 **팀 단위 예산 정산 자동화 서비스**

인하대학교 클라우드컴퓨팅 기말프로젝트 | Team BudgetFlow

---

## 시스템 구성

```
[팀원] Slack 채널에 영수증 / 지출 설명 입력
         ↓
[슬랙 봇]  Webhook 수신 → 즉시 접수 응답
         ↓
[백엔드]   Step Functions 비동기 분석 파이프라인
         ↓
[LLM/OCR] 텍스트 파싱 / 영수증 OCR / 카테고리 분류
         ↓
[프론트엔드] 관리자 대시보드에서 검토 → 엑셀 다운로드
```

## 기술 스택

| 역할       | 기술                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| 프론트엔드 | Next.js · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query          |
| 백엔드     | AWS Lambda · API Gateway · DynamoDB · S3 · Cognito · Step Functions · CDK |
| LLM/OCR    | Amazon Bedrock (Claude) · Amazon Textract                                 |
| 슬랙 봇    | Slack Bolt for JavaScript · AWS Lambda                                    |

## 로컬 실행 (프론트엔드)

```bash
cd budgetflow-frontend
npm install
npm run dev
```

`http://localhost:3000` 접속 후 테스트 계정으로 로그인:

- 이메일: `admin@budgetflow.dev`
- 비밀번호: `budgetflow`

## 주요 문서

| 문서                                                                    | 내용                                     |
| ----------------------------------------------------------------------- | ---------------------------------------- |
| [기획 총정리](./BudgetFlow_기획_총정리.md)                              | 서비스 기획, 아키텍처, 팀 역할           |
| [MVP 전체정리](./BudgetFlow_MVP_전체정리.md)                            | MVP 범위, 프론트 구현 현황, 다음 단계    |
| [API 명세서](./BudgetFlow_API_명세서.md)                                | 프론트↔백엔드 API 계약 (15개 엔드포인트) |
| [백엔드 API 계약](./BudgetFlow_백엔드_API_계약.md)                      | 요청/응답 예시 포함 상세 계약            |
| [백엔드 연동 리뷰](./budgetflow-frontend/docs/backend-integration-review.md) | 현재 백엔드 상태 분석 및 연동 순서       |
| [디자인 원칙](./budgetflow-frontend/DESIGN.md)                               | UI/UX 디자인 시스템                      |
| [기여 가이드](./CONTRIBUTING.md)                                        | 포크 및 PR 워크플로우                    |

## 팀

| 역할       | 담당   |
| ---------- | ------ |
| 프론트엔드 | 백승엽 |
| 백엔드     | 박성아 |
| LLM/OCR    | 진수연 |
| 슬랙 봇    | 장하민 |
