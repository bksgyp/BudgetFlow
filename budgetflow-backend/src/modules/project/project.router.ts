import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { pool } from '../../config/database';
import { seedDefaultCategoriesForProject } from '../../config/default-categories';

const router = Router();

// 1. 프로젝트 목록 조회
router.get('/', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT * FROM projects WHERE organization_id = $1 ORDER BY status = 'active' DESC, created_at DESC`,
    [req.user?.organizationId]
  );
  res.status(200).json(result.rows);
}));

// 2. 프로젝트 단건 조회
router.get('/:projectId', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.projectId]);
  if (result.rows.length === 0) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
  res.status(200).json(result.rows[0]);
}));

// 3. 프로젝트 생성
router.post('/', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, totalBudget, slackChannelName, templateFileName } = req.body;
  const id = `proj_${Date.now()}`;
  const organizationId = req.user?.organizationId;
  const slackChannelId = `C_${Date.now()}`;
  const cleanChannelName = slackChannelName?.replace(/^#/, '');
  const mappingStatus = templateFileName ? 'suggested' : 'none';
  const result = await pool.query(
    `INSERT INTO projects (id, organization_id, name, total_budget, slack_channel_id, slack_channel_name, template_file_name, template_mapping_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, organizationId, name, totalBudget, slackChannelId, cleanChannelName, templateFileName || null, mappingStatus]
  );
  // 신규 프로젝트도 전사 공통 표준 세무 카테고리를 갖도록 자동 시드한다.
  await seedDefaultCategoriesForProject(pool, id);
  res.status(201).json(result.rows[0]);
}));

// 4. 정산 마감
router.post('/:projectId/close', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `UPDATE projects SET status = 'closed', closed_at = NOW() WHERE id = $1 RETURNING *`,
    [req.params.projectId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
  res.status(200).json(result.rows[0]);
}));

export const projectRouter = router;