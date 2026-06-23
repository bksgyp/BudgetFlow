# 표준 세무 카테고리 (전사 공통)

BudgetFlow의 모든 프로젝트는 아래 표준 세무 계정과목 카테고리를 **공통**으로 사용한다.
LLM 분류기는 이 목록을 **하드코딩하지 않는다**. 런타임에는 백엔드가
`budget_categories`(프로젝트별)에서 카테고리를 읽어 `POST /analyze/*` 요청의
`categories` 필드로 주입하고, `promptBuilder.formatCategories`가 프롬프트에 삽입한다.
따라서 백엔드가 모든 프로젝트에 동일 세트를 시드하면 LLM 분류 기준이 전사적으로 일관된다.

> 원본 정의: `budgetflow-backend/src/config/default-categories.ts`

| id key | name (계정과목) | keywords |
| --- | --- | --- |
| welfare   | 복리후생비     | 복리후생, 다과, 간식, 음료, 커피, 직원회식, 경조사, 식대 |
| travel    | 여비교통비     | 교통, 택시, 버스, 지하철, KTX, 출장, 주차, 유류 |
| entertain | 기업업무추진비 | 접대, 거래처, 협력사, 선물, 경조사비 |
| supplies  | 소모품비       | 소모품, 문구, 비품, 사무용품, 프린터, 토너, 용지 |
| ad        | 광고선전비     | 광고, 홍보, 포스터, 현수막, 배너, 인쇄, 마케팅 |
| meeting   | 회의비         | 회의, 미팅, 세미나, 워크숍, 간담회 |
| fee       | 지급수수료     | 수수료, 결제수수료, 송금, 플랫폼, 구독, 라이선스 |
| comm      | 통신비         | 통신, 인터넷, 휴대폰, 전화, 요금, 데이터 |

## 분류 동작
- 카테고리 id는 프로젝트별로 `cat_{key}_{projectId}` 형태로 생성된다(전 프로젝트 동일 name/keywords).
- LLM은 입력 텍스트/영수증을 위 keywords와 의미적으로 매칭해 `categoryId`/`categoryName`을 선택한다.
- 동률·모호 시 `categoryId`는 null로 두고 관리자 검토(needs_review)로 넘긴다.

## 주의
- `src/test-*.ts`의 오프라인 벤치마크 픽스처는 과거 운영 분류(다과비/식비/교통비/회의비)에 대한
  기대 단정을 포함하므로 본 표준화에서 변경하지 않았다. 신규 테스트는 위 표준 세트를 기준으로 작성한다.
