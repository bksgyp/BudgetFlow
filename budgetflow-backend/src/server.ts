import app from './app';
import { pool } from './config/database';
import { ensureDefaultCategoriesAllProjects } from './config/default-categories';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 BudgetFlow 단일 통합 서버가 포트 ${PORT}에서 정상 기동 중입니다!`);
  // 기존 모든 프로젝트에 표준 세무 카테고리를 멱등 백필한다(분류 기준 전사 통일).
  try {
    await ensureDefaultCategoriesAllProjects(pool);
    console.log('✅ 표준 세무 카테고리 백필 완료');
  } catch (err) {
    console.error('⚠️ 표준 세무 카테고리 백필 실패:', err);
  }
});
