import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { pool } from '../../config/database';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import {
  BRAND_NAME,
  BRAND_DESCRIPTION,
  BRAND_DISCLAIMER,
  BRAND_LOGO_PNG_BASE64,
} from '../../assets/brand';

const router = Router();

// 1. Export job 목록 조회
router.get('/:projectId/exports', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    'SELECT * FROM export_jobs WHERE project_id = $1 ORDER BY created_at DESC',
    [req.params.projectId]
  );
  res.status(200).json(result.rows);
}));

// 2. 지출내역서 엑셀 생성
router.post('/:projectId/exports/expense-report', authenticateJWT, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId } = req.params;

  const projectResult = await pool.query(
    'SELECT name, slack_channel_name FROM projects WHERE id = $1',
    [projectId],
  );
  const project = projectResult.rows[0] ?? { name: projectId, slack_channel_name: '' };

  const expenses = await pool.query(
    `SELECT e.*, bc.name AS category_name
     FROM expenses e
     LEFT JOIN budget_categories bc ON e.category_id = bc.id
     WHERE e.project_id = $1 AND e.status = 'approved'
     ORDER BY e.date`,
    [projectId]
  );
  const excluded = await pool.query(
    `SELECT COUNT(*) FROM expenses WHERE project_id = $1 AND status = 'needs_review'`,
    [projectId]
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('지출내역서');
  sheet.columns = [
    { header: '날짜', key: 'date', width: 15 },
    { header: '사용처', key: 'merchant', width: 20 },
    { header: '내용', key: 'description', width: 30 },
    { header: '카테고리', key: 'category_name', width: 15 },
    { header: '금액', key: 'amount', width: 12 },
    { header: '결제자', key: 'payer_name', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' }
  };
  expenses.rows.forEach(row => sheet.addRow(row));

  // ── 브랜드 / 면책 푸터 (데이터 표 마지막 아래) ───────────────────────────
  const dataEndRow = 1 + expenses.rows.length; // 헤더 + 데이터
  const brandRowNum = dataEndRow + 2;          // 한 줄 비우고 브랜드 행

  const logoId = workbook.addImage({
    base64: BRAND_LOGO_PNG_BASE64,
    extension: 'png',
  });
  // 로고는 A열, 브랜드명 행 높이에 맞춰 앵커(0-indexed row)
  sheet.addImage(logoId, {
    tl: { col: 0, row: brandRowNum - 1 },
    ext: { width: 36, height: 36 },
    editAs: 'oneCell',
  });

  const brandRow = sheet.getRow(brandRowNum);
  brandRow.height = 28;
  const brandCell = brandRow.getCell(2);
  brandCell.value = BRAND_NAME;
  brandCell.font = { bold: true, size: 14, color: { argb: 'FF1677FF' } };
  brandCell.alignment = { vertical: 'middle' };

  const descCell = sheet.getRow(brandRowNum + 1).getCell(2);
  descCell.value = BRAND_DESCRIPTION;
  descCell.font = { size: 10, color: { argb: 'FF8C8C8C' } };

  const disclaimerRowNum = brandRowNum + 3;
  sheet.mergeCells(disclaimerRowNum, 1, disclaimerRowNum, 6);
  const disclaimerCell = sheet.getCell(disclaimerRowNum, 1);
  disclaimerCell.value = BRAND_DISCLAIMER;
  disclaimerCell.font = { size: 9, italic: true, color: { argb: 'FF8C8C8C' } };
  disclaimerCell.alignment = { wrapText: true, vertical: 'top' };
  sheet.getRow(disclaimerRowNum).height = 56;

  const jobId = `export_${uuidv4()}`;
  await pool.query(
    `INSERT INTO export_jobs (id, project_id, type, status, included_expense_count, excluded_review_count)
     VALUES ($1, $2, 'expense_report', 'completed', $3, $4)`,
    [jobId, projectId, expenses.rows.length, parseInt(excluded.rows[0].count)]
  );

  // 파일명: "프로젝트명(슬랙명)_report.xlsx" — 비ASCII는 RFC5987(filename*)로 인코딩
  const slack = project.slack_channel_name ? `(${project.slack_channel_name})` : '';
  const downloadName = `${project.name}${slack}_report.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  );
  await workbook.xlsx.write(res);
  res.end();
}));

export const exportRouter = router;