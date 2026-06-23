// 데모용 시드 스크립트 (혼합 레이어드 C안)
// Phase 1+2: 프로젝트·카테고리 삽입
// Phase 3:   Faker 한국어 지출 20건
// Phase 4:   HuggingFace CORD v2 영수증 이미지 → S3 → LLM OCR → DB (LLM 기동 시에만)
//
// 실행: npm run seed:demo

import { Pool } from "pg";
import * as dotenv from "dotenv";
import { faker } from "@faker-js/faker/locale/ko";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { DEFAULT_CATEGORIES, categoryId } from "../../src/config/default-categories";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "budgetflow",
});

const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-northeast-2" });
const LLM_URL = process.env.LLM_SERVICE_URL ?? "http://localhost:4001";
const S3_BUCKET = process.env.S3_BUCKET_NAME!;

// ─── 상수 ─────────────────────────────────────────────────────────────────

const DEMO_PROJECTS = [
  {
    id: "project-aingthon",
    organization_id: "org_inha_cs_2026",
    name: "2026 여름 해커톤",
    total_budget: 2000000,
    status: "active",
    slack_channel_id: "C-DEMO-ACTIVE",
    slack_channel_name: "demo-hackathon-budget",
    template_file_name: null,
    template_mapping_status: "none",
    created_at: "2026-05-20T10:00:00+09:00",
    closed_at: null,
  },
  {
    id: "project-demo-closed",
    organization_id: "org_inha_cs_2026",
    name: "상반기 세미나 정산",
    total_budget: 500000,
    status: "closed",
    slack_channel_id: "C-DEMO-CLOSED",
    slack_channel_name: "demo-seminar-budget",
    template_file_name: "seminar_report.xlsx",
    template_mapping_status: "confirmed",
    created_at: "2026-03-01T10:00:00+09:00",
    closed_at: "2026-04-30T18:00:00+09:00",
  },
] as const;

// 전사 공통 표준 세무 계정과목을 두 데모 프로젝트에 동일하게 생성한다.
const DEMO_CATEGORY_PROJECTS = ["project-aingthon", "project-demo-closed"];
const DEMO_CATEGORIES = DEMO_CATEGORY_PROJECTS.flatMap((projectId) =>
  DEFAULT_CATEGORIES.map((c) => ({
    id: categoryId(c.key, projectId),
    project_id: projectId,
    name: c.name,
    budget_limit: 0,
    keywords: c.keywords,
  })),
);

// status 분포: approved 10, needs_review 5, rejected 3, created 2
const STATUS_DISTRIBUTION: string[] = [
  ...Array(10).fill("approved"),
  ...Array(5).fill("needs_review"),
  ...Array(3).fill("rejected"),
  ...Array(2).fill("created"),
];

const MERCHANTS_KO = [
  "스타벅스 인하점",
  "GS25 용현동점",
  "맘스터치 인하대점",
  "도시락팩토리",
  "다이소 인하대점",
  "파리바게뜨 용현점",
  "교보문구 인천점",
  "CU 제물포점",
  "롯데마트 인천점",
  "이마트24 용현점",
  "배달의민족 주문",
  "카페베네 인하점",
  "BBQ치킨",
  "피자헛 인천점",
  "할리스커피 인하점",
];

const CLOSED_MERCHANTS = ["세미나 도시락", "편의점GS", "인쇄소"];

const MERCHANT_MENUS: Record<string, string> = {
  "스타벅스 인하점": "아메리카노, 카페라떼",
  "GS25 용현동점": "삼각김밥, 컵라면",
  "맘스터치 인하대점": "싸이버거, 허니버터치킨",
  도시락팩토리: "제육볶음 도시락, 불고기 도시락",
  "다이소 인하대점": "문구류, 소모품",
  "파리바게뜨 용현점": "아메리카노, 크루아상",
  "교보문구 인천점": "볼펜, 노트",
  "CU 제물포점": "삼각김밥, 음료",
  "롯데마트 인천점": "식재료, 생활용품",
  "이마트24 용현점": "샌드위치, 음료",
  "배달의민족 주문": "치킨, 피자",
  "카페베네 인하점": "아메리카노, 카페모카",
  BBQ치킨: "황금올리브치킨, 양념치킨",
  "피자헛 인천점": "페퍼로니피자, 슈프림피자",
  "할리스커피 인하점": "아메리카노, 헤이즐넛라떼",
  "세미나 도시락": "불고기 도시락, 김치찌개 도시락",
  편의점GS: "삼각김밥, 음료",
  인쇄소: "흑백 인쇄, 컬러 인쇄",
};

// ─── Phase 0: LLM 헬스체크 ────────────────────────────────────────────────

async function checkLlmHealth(): Promise<boolean> {
  try {
    await axios.get(`${LLM_URL}/health`, { timeout: 2000 });
    console.log("[Seed] LLM 서비스 기동 확인 → OCR Phase 실행");
    return true;
  } catch {
    console.warn(
      "[Seed] LLM 서비스 미기동 → OCR Phase 스킵 (Faker 20건만 삽입)",
    );
    return false;
  }
}

// ─── Phase 1+2: 프로젝트·카테고리 삽입 ───────────────────────────────────

async function seedProjectsAndCategories(client: any) {
  for (const p of DEMO_PROJECTS) {
    await client.query(
      `INSERT INTO projects
        (id, organization_id, name, total_budget, status,
         slack_channel_id, slack_channel_name, template_file_name,
         template_mapping_status, created_at, closed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id,
        p.organization_id,
        p.name,
        p.total_budget,
        p.status,
        p.slack_channel_id,
        p.slack_channel_name,
        p.template_file_name,
        p.template_mapping_status,
        p.created_at,
        p.closed_at,
      ],
    );
  }

  for (const c of DEMO_CATEGORIES) {
    await client.query(
      `INSERT INTO budget_categories (id, project_id, name, budget_limit, keywords)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO NOTHING`,
      [c.id, c.project_id, c.name, c.budget_limit, c.keywords],
    );
  }
  console.log(`[Seed] Phase 1+2 완료: 프로젝트 2개, 카테고리 ${DEMO_CATEGORIES.length}개`);
}

// ─── Phase 3: Faker 지출 20건 ─────────────────────────────────────────────

async function seedFakerExpenses(client: any) {
  // 재실행 시 중복 방지: 기존 faker 지출 삭제
  const projectIds = DEMO_PROJECTS.map((p) => p.id);
  await client.query(`DELETE FROM expenses WHERE project_id = ANY($1)`, [
    projectIds,
  ]);

  const activeCategories = DEMO_CATEGORIES.filter(
    (c) => c.project_id === "project-aingthon",
  );

  for (let i = 0; i < 20; i++) {
    const status = STATUS_DISTRIBUTION[i];
    const isActive = i < 17; // 17건은 active, 3건은 closed
    const projectId = isActive ? "project-aingthon" : "project-demo-closed";
    const categories = isActive
      ? activeCategories
      : DEMO_CATEGORIES.filter((c) => c.project_id === "project-demo-closed");

    const cat = faker.helpers.arrayElement(categories);
    const id = `exp_${uuidv4()}`;
    const amount = faker.number.int({ min: 10000, max: 200000 });
    const merchant = isActive
      ? faker.helpers.arrayElement(MERCHANTS_KO)
      : faker.helpers.arrayElement(CLOSED_MERCHANTS);
    const dateFrom = isActive ? "2026-05-20" : "2026-03-01";
    const dateTo = isActive ? "2026-06-15" : "2026-04-25";
    const date = faker.date
      .between({ from: dateFrom, to: dateTo })
      .toISOString()
      .split("T")[0];
    const payerName = faker.person.fullName();
    const slackUserId = `U-DEMO-${String(i).padStart(3, "0")}`;

    // status별 파생 필드
    const evidenceStatus =
      status === "approved"
        ? "verified"
        : status === "needs_review"
          ? i % 2 === 0
            ? "none"
            : "uploaded"
          : "none";

    const aiConfidence = parseFloat(
      (status === "approved"
        ? faker.number.float({ min: 0.85, max: 0.99 })
        : status === "needs_review"
          ? faker.number.float({ min: 0.5, max: 0.79 })
          : faker.number.float({ min: 0.3, max: 0.65 })
      ).toFixed(2),
    );

    const reviewReason =
      status === "needs_review"
        ? "영수증 금액 불일치"
        : status === "rejected"
          ? faker.helpers.arrayElement([
              "예산 초과",
              "중복 지출",
              "증빙 불충분",
            ])
          : null;

    const missingFields =
      status === "needs_review" && evidenceStatus === "none"
        ? ["evidenceFile"]
        : [];

    await client.query(
      `INSERT INTO expenses
        (id, project_id, category_id, date, amount, merchant, description,
         payer_name, input_channel, slack_user_id,
         status, evidence_status, ai_confidence, missing_fields, review_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'slack',$9,$10,$11,$12,$13,$14)`,
      [
        id,
        projectId,
        cat.id,
        date,
        amount,
        merchant,
        MERCHANT_MENUS[merchant] ?? `${merchant} 이용`,
        payerName,
        slackUserId,
        status,
        evidenceStatus,
        aiConfidence,
        missingFields,
        reviewReason,
      ],
    );
  }
  console.log("[Seed] Phase 3 완료: Faker 지출 20건");
}

// ─── Phase 4: HuggingFace OCR ─────────────────────────────────────────────

async function seedOcrExpenses() {
  if (!S3_BUCKET) {
    console.warn("[Seed] S3_BUCKET_NAME 환경변수 없음 → OCR Phase 스킵");
    return;
  }

  // HuggingFace CORD v2 이미지 목록 수집
  let rows: any[];
  try {
    const hfRes = await axios.get(
      "https://datasets-server.huggingface.co/rows" +
        "?dataset=naver-clova-ix%2Fcord-v2&config=default&split=train&offset=0&length=8",
      { timeout: 10000 },
    );
    rows = hfRes.data.rows;
  } catch (err: any) {
    console.warn("[Seed] HuggingFace API 실패 → OCR Phase 스킵:", err.message);
    return;
  }

  const activeCategories = DEMO_CATEGORIES.filter(
    (c) => c.project_id === "project-aingthon",
  ).map((c) => ({
    id: c.id,
    name: c.name,
    keywords: c.keywords,
    budgetLimit: c.budget_limit,
  }));

  let successCount = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    try {
      const imageUrl: string = rows[idx].row.image.src;

      // 이미지 다운로드
      const imgRes = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
      });
      const buffer = Buffer.from(imgRes.data);
      const s3Key = `receipts/cord_${Date.now()}_${idx}.jpg`;

      // S3 업로드
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: buffer,
          ContentType: "image/jpeg",
        }),
      );

      const evidenceFileId = `evf_${uuidv4()}`;
      const expenseId = `exp_${uuidv4()}`;

      // LLM /analyze/image 호출
      const llmRes = await axios.post(
        `${LLM_URL}/analyze/image`,
        {
          inputType: "image",
          s3Key,
          projectId: "project-aingthon",
          evidenceFileId,
          submittedBy: {
            userId: `U-CORD-${idx}`,
            displayName: `CORD 테스터${idx + 1}`,
          },
          categories: activeCategories,
        },
        { timeout: 60000 },
      );
      const llm = llmRes.data;
      const today = new Date().toISOString().split("T")[0];

      // expenses 삽입
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO expenses
            (id, project_id, category_id, date, amount, merchant, description,
             payer_name, input_channel, slack_user_id,
             status, evidence_status, evidence_file_id,
             ai_confidence, missing_fields, review_reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'slack',$9,$10,$11,$12,$13,$14,$15)`,
          [
            expenseId,
            "project-aingthon",
            llm.categoryId ?? null,
            llm.date ?? today,
            llm.amount ?? 0,
            llm.merchant ?? "미확인",
            llm.description ?? "영수증",
            "(OCR 테스트)",
            `U-CORD-${idx}`,
            llm.needsReview ? "needs_review" : "created",
            llm.evidenceStatus ?? "ocr_completed",
            evidenceFileId,
            llm.aiConfidence ?? 0.0,
            llm.missingFields ?? [],
            llm.reviewReason ?? null,
          ],
        );

        // evidence_files 삽입
        await client.query(
          `INSERT INTO evidence_files
            (id, project_id, expense_id, file_name, file_type, url, ocr_status)
           VALUES ($1,$2,$3,$4,'image',$5,$6)`,
          [
            evidenceFileId,
            "project-aingthon",
            expenseId,
            `cord_${idx}.jpg`,
            `https://${S3_BUCKET}.s3.ap-northeast-2.amazonaws.com/${s3Key}`,
            llm.evidenceStatus ?? "ocr_completed",
          ],
        );
        successCount++;
        console.log(
          `[Seed] OCR ${idx + 1}/${rows.length} 완료: ${llm.merchant ?? "미확인"} ${(llm.amount ?? 0).toLocaleString()}원`,
        );
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error(
        `[Seed] OCR ${idx + 1}/${rows.length} 실패 (스킵):`,
        err.message,
      );
    }
  }
  console.log(`[Seed] Phase 4 완료: OCR 지출 ${successCount}/${rows.length}건`);
}

// ─── 메인 ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("[Seed] 데모 시드 시작...");

  const llmAlive = await checkLlmHealth();

  // Phase 1~3: 트랜잭션으로 묶어 원자 처리
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await seedProjectsAndCategories(client);
    await seedFakerExpenses(client);
    await client.query("COMMIT");
    console.log("[Seed] Phase 1~3 커밋 완료");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Seed] Phase 1~3 실패, 롤백:", err);
    throw err;
  } finally {
    client.release();
  }

  // Phase 4: S3 포함이라 트랜잭션 밖에서 실행, 실패 허용
  if (llmAlive) {
    await seedOcrExpenses();
  }

  console.log("[Seed] 데모 시드 완료!");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
