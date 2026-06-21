import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { pool } from '../../config/database';
import { aiOcrService } from '../ai_ocr/ai_ocr.service';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// 1. 지출 목록 조회
router.get('/', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, status } = req.query;
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params: any[] = [];
  if (projectId) {
    params.push(projectId);
    query += ` AND project_id = $${params.length}`;
  }
  if (status && status !== 'all') {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  res.status(200).json(result.rows);
}));

// 2. 지출 요약
router.get('/summary', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query;
  const result = await pool.query(
    `SELECT
      COUNT(*) AS "totalExpenseCount",
      COUNT(*) FILTER (WHERE status = 'needs_review') AS "needsReviewCount",
      COUNT(*) FILTER (WHERE status = 'approved') AS "approvedCount",
      COUNT(*) FILTER (WHERE status = 'rejected') AS "rejectedCount",
      COUNT(*) FILTER (WHERE evidence_status = 'none') AS "missingEvidenceCount",
      COALESCE(SUM(amount) FILTER (WHERE status IN ('approved', 'exported')), 0) AS "approvedAmount"
    FROM expenses WHERE project_id = $1`,
    [projectId]
  );
  res.status(200).json({ projectId, ...result.rows[0] });
}));

// 3. 지출 승인
router.patch('/:expenseId/approve', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date, amount, categoryId, description, merchant, payerName } = req.body;
  const result = await pool.query(
    `UPDATE expenses SET status = 'approved', date = $1, amount = $2, category_id = $3,
     description = $4, merchant = COALESCE($5, merchant), payer_name = COALESCE($6, payer_name), review_reason = null, updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [date, amount, categoryId, description, merchant, payerName, req.params.expenseId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: '지출을 찾을 수 없습니다.' });
  res.status(200).json(result.rows[0]);
}));

// 4. 지출 반려
router.patch('/:expenseId/reject', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  const result = await pool.query(
    `UPDATE expenses SET status = 'rejected', review_reason = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [reason || '관리자 반려', req.params.expenseId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: '지출을 찾을 수 없습니다.' });
  res.status(200).json(result.rows[0]);
}));

// 5. 봇 → 백엔드 지출 등록 (인증 없음)
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { slackUserId, channelId, type, text, imageUrl, projectId, submittedBy } = req.body;
  if (!slackUserId || !channelId || !type) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
  }
  const today = new Date().toISOString().split('T')[0];

  // projectId 기준으로 카테고리 자동 조회 (봇이 categories를 보내지 않아도 LLM이 분류 가능하도록)
  const catResult = await pool.query(
    `SELECT id, name, keywords FROM budget_categories WHERE project_id = $1`,
    [projectId]
  );
  const categories = catResult.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    keywords: r.keywords ?? [],
  }));

  if (type === 'text') {
    const llmResult = await aiOcrService.analyzeText({
      text, projectId, requestDate: today,
      timezone: 'Asia/Seoul', submittedBy, categories,
    });
    if (llmResult.action === 'request_re_input') {
      return res.status(200).json({ action: 'request_re_input', userId: slackUserId });
    }
    const result = await pool.query(
      `INSERT INTO expenses
        (id, project_id, slack_user_id, date, amount, merchant, description,
         category_id, payer_name, evidence_status, ai_confidence, status, missing_fields, review_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        `exp_${uuidv4()}`,
        projectId, slackUserId,
        llmResult.date ?? today,
        llmResult.amount,
        llmResult.merchant ?? '미확인',
        llmResult.description,
        llmResult.categoryId,
        llmResult.payerName ?? submittedBy?.displayName ?? '미확인',
        llmResult.evidenceStatus,
        llmResult.aiConfidence,
        llmResult.needsReview ? 'needs_review' : 'created',
        llmResult.missingFields,
        llmResult.reviewReason,
      ]
    );
    return res.status(200).json(result.rows[0]);
  }

  if (type === 'image' || type === 'text_image') {
    // 봇이 전달하는 imageUrl은 S3 객체 URL 전체이므로, LLM에는 객체 키만 추출해서 전달
    const s3Key = decodeURIComponent(new URL(imageUrl).pathname.slice(1));
    const llmResult = await aiOcrService.analyzeImage({
      s3Key, projectId, evidenceFileId: s3Key,
      submittedBy, categories,
    });
    if (llmResult.amount === null) {
      return res.status(200).json({ action: 'request_re_input', userId: slackUserId });
    }
    const result = await pool.query(
      `INSERT INTO expenses
        (id, project_id, slack_user_id, date, amount, merchant, description,
         category_id, payer_name, evidence_status, evidence_file_id,
         ai_confidence, status, missing_fields, review_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        `exp_${uuidv4()}`,
        projectId, slackUserId,
        llmResult.date ?? today,
        llmResult.amount,
        llmResult.merchant ?? '미확인',
        llmResult.description,
        llmResult.categoryId,
        llmResult.payerName ?? submittedBy?.displayName ?? '미확인',
        llmResult.evidenceStatus,
        llmResult.evidenceFileId,
        llmResult.aiConfidence,
        llmResult.needsReview ? 'needs_review' : 'created',
        llmResult.missingFields,
        llmResult.reviewReason,
      ]
    );
    return res.status(200).json(result.rows[0]);
  }

  return res.status(400).json({ error: '지원하지 않는 type입니다.' });
}));

export const expenseRouter = router;
