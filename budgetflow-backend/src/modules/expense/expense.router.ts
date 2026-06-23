import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { pool } from '../../config/database';
import { aiOcrService } from '../ai_ocr/ai_ocr.service';
import { taxService } from '../tax/tax.service';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const router = Router();

// 증빙 s3Key(evidence_file_id) → 브라우저 조회용 이미지 URL.
// 영수증 객체는 비공개이므로(버킷 퍼블릭 차단) presigned URL을 발급해
// 자격증명 없는 브라우저에서도 시간제한 동안 안전하게 접근할 수 있게 한다.
// S3 접근은 EC2 IAM Role 자격증명을 사용한다(별도 Access Key 불필요).
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const PRESIGN_TTL = Number(process.env.S3_PRESIGN_TTL_SECONDS || 3600); // 기본 1시간
const s3Client = S3_BUCKET ? new S3Client({ region: AWS_REGION }) : null;

async function resolveImageUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;
  // 이미 완전한 URL이 저장된 경우(레거시) 그대로 사용한다.
  if (/^https?:\/\//.test(key)) return key;
  if (!s3Client || !S3_BUCKET) return null;
  try {
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      { expiresIn: PRESIGN_TTL },
    );
  } catch {
    return null;
  }
}

async function withImageUrl<T extends { evidence_file_id?: string | null }>(row: T) {
  return { ...row, image_url: await resolveImageUrl(row.evidence_file_id) };
}

router.get('/', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, status } = req.query;
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params: any[] = [];
  if (projectId) { params.push(projectId); query += ` AND project_id = $${params.length}`; }
  if (status && status !== 'all') { params.push(status); query += ` AND status = $${params.length}`; }
  query += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(query, params);
  res.status(200).json(await Promise.all(rows.map(withImageUrl)));
}));

router.get('/summary', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query;
  const result = await pool.query(
    `SELECT COUNT(*) AS "totalExpenseCount",
      COUNT(*) FILTER (WHERE status = 'needs_review') AS "needsReviewCount",
      COUNT(*) FILTER (WHERE status = 'approved') AS "approvedCount",
      COUNT(*) FILTER (WHERE status = 'rejected') AS "rejectedCount",
      COUNT(*) FILTER (WHERE evidence_status = 'none') AS "missingEvidenceCount",
      COALESCE(SUM(amount) FILTER (WHERE status IN ('approved','exported')), 0) AS "approvedAmount"
    FROM expenses WHERE project_id = $1`,
    [projectId],
  );
  res.status(200).json({ projectId, ...result.rows[0] });
}));

router.patch('/:expenseId/approve', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date, amount, categoryId, description, merchant, payerName } = req.body;
  const result = await pool.query(
    `UPDATE expenses SET status='approved', date=$1, amount=$2, category_id=$3,
     description=$4, merchant=COALESCE($5,merchant), payer_name=COALESCE($6,payer_name),
     review_reason=null, updated_at=NOW() WHERE id=$7 RETURNING *`,
    [date, amount, categoryId, description, merchant, payerName, req.params.expenseId],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: '지출을 찾을 수 없습니다.' });
  res.status(200).json(await withImageUrl(result.rows[0]));
}));

router.patch('/:expenseId/reject', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  const result = await pool.query(
    `UPDATE expenses SET status='rejected', review_reason=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [reason || '관리자 반려', req.params.expenseId],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: '지출을 찾을 수 없습니다.' });
  res.status(200).json(await withImageUrl(result.rows[0]));
}));

// 지출 삭제 — 연결된 evidence_files는 FK ON DELETE CASCADE로 함께 제거된다.
router.delete('/:expenseId', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    'DELETE FROM expenses WHERE id = $1 RETURNING id',
    [req.params.expenseId],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: '지출을 찾을 수 없습니다.' });
  res.status(200).json({ id: result.rows[0].id, deleted: true });
}));

router.patch('/:expenseId/tax-review', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await taxService.updateTaxReview(req.params.expenseId as string, req.body);
  if (!result) return res.status(404).json({ error: '지출을 찾을 수 없습니다.' });
  res.status(200).json(result);
}));

// 봇 전용 — 인증 없음
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    slackUserId, channelId, type, text,
    imageUrl, imageS3Key,
    projectId, submittedBy,
    paymentMethod, businessPurpose, taxPeriod, slackTs,
  } = req.body;

  if (!slackUserId || !channelId || !type)
    return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });

  const today = new Date().toISOString().split('T')[0];
  const period = taxPeriod ?? today.slice(0, 7);

  const catResult = await pool.query(
    `SELECT id, name, keywords FROM budget_categories WHERE project_id = $1`, [projectId],
  );
  const categories = catResult.rows.map((r: any) => ({ id: r.id, name: r.name, keywords: r.keywords ?? [] }));

  if (type === 'text') {
    const llm = await aiOcrService.analyzeText({ text, projectId, requestDate: today, timezone: 'Asia/Seoul', submittedBy, categories });
    if (llm.action === 'request_re_input') return res.status(200).json({ action: 'request_re_input', userId: slackUserId });
    const result = await pool.query(
      `INSERT INTO expenses (id,project_id,slack_user_id,date,amount,merchant,description,
         category_id,payer_name,evidence_status,ai_confidence,status,missing_fields,review_reason,
         tax_invoice_type,payment_method,business_purpose,vat_class,vat_reason,deductibility,
         tax_review_status,tax_review_reason,ocr_quality,ocr_failure_mode,tax_period,slack_ts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [`exp_${uuidv4()}`, projectId, slackUserId, llm.date ?? today, llm.amount,
       llm.merchant ?? '미확인', llm.description, llm.categoryId,
       llm.payerName ?? submittedBy?.displayName ?? '미확인',
       llm.evidenceStatus, llm.aiConfidence, llm.needsReview ? 'needs_review' : 'created',
       llm.missingFields, llm.reviewReason,
       llm.taxInvoiceType ?? 'unknown', llm.paymentMethod ?? paymentMethod ?? 'unknown',
       llm.businessPurpose ?? businessPurpose ?? null,
       llm.vatClass ?? 'unknown', llm.vatReason ?? null, llm.deductibility ?? 'unknown',
       llm.taxReviewStatus ?? 'needs_review', llm.taxReviewReason ?? null,
       llm.ocrQuality ?? 'good', llm.ocrFailureMode ?? null, period, slackTs ?? null],
    );
    return res.status(200).json(result.rows[0]);
  }

  if (type === 'image' || type === 'text_image') {
    const rawUrl = imageUrl || imageS3Key;
    if (!rawUrl) return res.status(400).json({ error: 'imageUrl 또는 imageS3Key가 필요합니다.' });
    let s3Key: string;
    try { s3Key = decodeURIComponent(new URL(rawUrl).pathname.slice(1)); }
    catch { s3Key = rawUrl; }
    const llm = await aiOcrService.analyzeImage({ s3Key, projectId, evidenceFileId: s3Key, submittedBy, categories });
    if (llm.amount === null) return res.status(200).json({ action: 'request_re_input', userId: slackUserId });
    const result = await pool.query(
      `INSERT INTO expenses (id,project_id,slack_user_id,date,amount,merchant,description,
         category_id,payer_name,evidence_status,evidence_file_id,ai_confidence,status,missing_fields,review_reason,
         tax_invoice_type,payment_method,business_purpose,vat_class,vat_reason,deductibility,
         tax_review_status,tax_review_reason,ocr_quality,ocr_failure_mode,tax_period,slack_ts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       RETURNING *`,
      [`exp_${uuidv4()}`, projectId, slackUserId, llm.date ?? today, llm.amount,
       llm.merchant ?? '미확인', llm.description, llm.categoryId,
       llm.payerName ?? submittedBy?.displayName ?? '미확인',
       llm.evidenceStatus, llm.evidenceFileId, llm.aiConfidence,
       llm.needsReview ? 'needs_review' : 'created', llm.missingFields, llm.reviewReason,
       llm.taxInvoiceType ?? 'unknown', llm.paymentMethod ?? paymentMethod ?? 'unknown',
       llm.businessPurpose ?? businessPurpose ?? null,
       llm.vatClass ?? 'unknown', llm.vatReason ?? null, llm.deductibility ?? 'unknown',
       llm.taxReviewStatus ?? 'needs_review', llm.taxReviewReason ?? null,
       llm.ocrQuality ?? (llm.evidenceStatus === 'ocr_failed' ? 'failed' : 'good'),
       llm.ocrFailureMode ?? null, period, slackTs ?? null],
    );
    return res.status(200).json(result.rows[0]);
  }

  return res.status(400).json({ error: '지원하지 않는 type입니다.' });
}));

export const expenseRouter = router;
