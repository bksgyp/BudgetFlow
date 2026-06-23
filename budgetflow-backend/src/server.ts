import app from './app';
import { pool } from './config/database';
import {
  ensureDefaultCategoriesAllProjects,
  remapLegacyCategories,
} from './config/default-categories';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 BudgetFlow 단일 통합 서버가 포트 ${PORT}에서 정상 기동 중입니다!`);
  // 기존 모든 프로젝트에 표준 세무 카테고리를 멱등 백필한다(분류 기준 전사 통일).
  try {
    // 스키마 마이그레이션(멱등): 상세 품목 저장용 items 컬럼 보장
    await pool.query(
      "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb",
    );
    await ensureDefaultCategoriesAllProjects(pool);
    await remapLegacyCategories(pool);
    console.log('✅ 표준 세무 카테고리 백필/정리 완료');
  } catch (err) {
    console.error('⚠️ 표준 세무 카테고리 백필 실패:', err);
  }
});
