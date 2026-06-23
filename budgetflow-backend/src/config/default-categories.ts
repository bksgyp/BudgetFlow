import { Pool } from 'pg';

/**
 * 모든 프로젝트가 공통으로 사용하는 표준 세무 계정과목 카테고리.
 * - LLM 분류는 백엔드가 budget_categories(프로젝트별)에서 읽어 프롬프트로 넘기므로,
 *   모든 프로젝트에 이 동일 세트를 시드하면 분류 기준이 전사적으로 일관된다.
 * - keywords는 LLM/규칙 기반 분류의 매칭 힌트로 사용된다.
 */
export interface DefaultCategory {
  /** 카테고리 식별 키 (프로젝트별 id 생성에 사용) */
  key: string;
  name: string;
  keywords: string[];
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { key: 'welfare',   name: '복리후생비',     keywords: ['복리후생', '다과', '간식', '음료', '커피', '직원회식', '경조사', '식대', '간식비'] },
  { key: 'travel',    name: '여비교통비',     keywords: ['교통', '택시', '버스', '지하철', 'KTX', '출장', '주차', '유류', '톨게이트', '항공'] },
  { key: 'entertain', name: '기업업무추진비', keywords: ['접대', '거래처', '협력사', '선물', '경조사비', '거래처회식'] },
  { key: 'supplies',  name: '소모품비',       keywords: ['소모품', '문구', '비품', '사무용품', '프린터', '토너', '용지', '잡화'] },
  { key: 'ad',        name: '광고선전비',     keywords: ['광고', '홍보', '포스터', '현수막', '배너', '인쇄', '마케팅', '디자인'] },
  { key: 'meeting',   name: '회의비',         keywords: ['회의', '미팅', '세미나', '워크숍', '간담회'] },
  { key: 'fee',       name: '지급수수료',     keywords: ['수수료', '결제수수료', '송금', '플랫폼', '구독', '라이선스', '이용료'] },
  { key: 'comm',      name: '통신비',         keywords: ['통신', '인터넷', '휴대폰', '전화', '요금', '데이터'] },
];

/** 프로젝트별 카테고리 id (안정적·멱등) — id PK 길이(VARCHAR(50)) 내로 자른다. */
export function categoryId(key: string, projectId: string): string {
  return `cat_${key}_${projectId}`.slice(0, 50);
}

/**
 * 한 프로젝트에 표준 카테고리를 멱등 삽입한다.
 * 이미 존재하는 id는 ON CONFLICT DO NOTHING으로 건너뛴다(기존 데이터 보존).
 */
export async function seedDefaultCategoriesForProject(
  pool: Pool,
  projectId: string,
): Promise<void> {
  for (const c of DEFAULT_CATEGORIES) {
    await pool.query(
      `INSERT INTO budget_categories (id, project_id, name, budget_limit, keywords)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (id) DO NOTHING`,
      [categoryId(c.key, projectId), projectId, c.name, c.keywords],
    );
  }
}

/**
 * 모든 기존 프로젝트에 표준 카테고리를 백필한다(멱등).
 * 서버 기동 시 1회 호출되어 전 프로젝트의 분류 기준을 통일한다.
 */
export async function ensureDefaultCategoriesAllProjects(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM projects');
  for (const row of rows) {
    await seedDefaultCategoriesForProject(pool, row.id);
  }
}

/**
 * 레거시(비표준) 카테고리 → 표준 카테고리 key 재매핑 allowlist.
 * 비표준 카테고리를 일괄 삭제하면 관리자가 직접 만든 카테고리까지 지워질 수 있으므로,
 * 반드시 명시한 id만 정리한다.
 */
export const LEGACY_CATEGORY_REMAP: { legacyId: string; toKey: string }[] = [
  { legacyId: 'cat_01', toKey: 'welfare' }, // proj_test '다과비' → 복리후생비
];

/**
 * allowlist에 명시된 레거시 카테고리를 표준 카테고리로 재매핑하고 삭제한다(멱등).
 * - 해당 카테고리를 참조하는 expenses.category_id를 같은 프로젝트의 표준 카테고리로 옮긴다.
 * - 이후 레거시 카테고리 행을 삭제한다.
 * 삭제 후에는 대상이 없어 자동으로 no-op이 된다.
 */
export async function remapLegacyCategories(pool: Pool): Promise<void> {
  for (const { legacyId, toKey } of LEGACY_CATEGORY_REMAP) {
    const { rows } = await pool.query<{ id: string; project_id: string }>(
      'SELECT id, project_id FROM budget_categories WHERE id = $1',
      [legacyId],
    );
    for (const row of rows) {
      const targetId = categoryId(toKey, row.project_id);
      // 표준 카테고리가 없으면 먼저 보장
      await seedDefaultCategoriesForProject(pool, row.project_id);
      await pool.query(
        'UPDATE expenses SET category_id = $1, updated_at = NOW() WHERE category_id = $2',
        [targetId, legacyId],
      );
      await pool.query('DELETE FROM budget_categories WHERE id = $1', [legacyId]);
    }
  }
}
