# BudgetFlow

> 슬랙에 영수증과 지출 설명을 보내면 AI가 자동 분석하고, 관리자가 검토 후 제출용 엑셀을 내려받는 **팀 단위 예산 정산 자동화 서비스**

인하대학교 클라우드컴퓨팅 기말프로젝트 | Team BudgetFlow

---

## 시스템 구성

```
[팀원] Slack 채널에 영수증 / 지출 설명 입력
         ↓
[슬랙 봇]  Slack 이미지/텍스트 수신 → S3 저장 → 백엔드 호출
         ↓
[백엔드]   Express API (EC2) → LLM 서비스 동기 호출
         ↓
[LLM/OCR] Claude Vision/Text로 영수증 OCR · 텍스트 파싱 · 카테고리 분류 · 세무 후보 추출
         ↓
[프론트엔드] 관리자 대시보드에서 검토 → 엑셀 다운로드
```

세 백엔드 서비스(백엔드 API, LLM, 슬랙 봇)는 단일 EC2 인스턴스에서 PM2로 각자 프로세스로 실행되며, `main` 브랜치에 머지되면 GitHub Actions가 SSH로 접속해 자동 배포합니다.

## 기술 스택

| 역할        | 기술                                                                  |
| ----------- | --------------------------------------------------------------------- |
| 프론트엔드  | Next.js · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query      |
| 백엔드      | Node.js · Express · PostgreSQL (pg) · JWT 인증 · AWS S3 (영수증 원본) |
| LLM/OCR     | Anthropic Claude API (Haiku/Sonnet, Vision) 직접 호출                 |
| 슬랙 봇     | Slack Bolt for JavaScript (Node.js)                                   |
| 배포/인프라 | AWS EC2 (PM2로 3개 서비스 상시 구동) · GitHub Actions CI/CD           |

## 로컬 실행 (프론트엔드)

```bash
cd budgetflow-frontend
npm install
npm run dev
```

`http://localhost:3000` 접속 후 테스트 계정으로 로그인:

- 이메일: `admin@inha.ac.kr`
- 비밀번호: 무관 (데모 계정은 비밀번호 검증 없이 통과)

## 주요 문서

| 문서                                                                         | 내용                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------- |
| [기획 총정리](./BudgetFlow_기획_총정리.md)                                   | 서비스 기획, 아키텍처, 팀 역할           |
| [MVP 전체정리](./BudgetFlow_MVP_전체정리.md)                                 | MVP 범위, 프론트 구현 현황, 다음 단계    |
| [API 명세서](./BudgetFlow_API_명세서.md)                                     | 프론트↔백엔드 API 계약 (15개 엔드포인트) |
| [백엔드 API 계약](./BudgetFlow_백엔드_API_계약.md)                           | 요청/응답 예시 포함 상세 계약            |
| [백엔드 연동 리뷰](./budgetflow-frontend/docs/backend-integration-review.md) | 현재 백엔드 상태 분석 및 연동 순서       |
| [디자인 원칙](./budgetflow-frontend/DESIGN.md)                               | UI/UX 디자인 시스템                      |
| [기여 가이드](./CONTRIBUTING.md)                                             | 포크 및 PR 워크플로우                    |

## 팀

| 역할       | 담당   |
| ---------- | ------ |
| 프론트엔드 | 백승엽 |
| 백엔드     | 박성아 |
| LLM/OCR    | 진수연 |
| 슬랙 봇    | 장하민 |
