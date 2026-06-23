import { pool } from '../../config/database';
import { classify } from './tax.classifier';
import { generateFindings } from './tax.findings';
import { calcFeeImpact } from './tax.fee-impact';
import { buildAccountantPacket, buildSelfFilingPacket, buildSelfFilingCsv } from './tax.exporter';
import { buildAccountantPacketPdf } from './tax.pdf';
import type { TaxExpenseRow, TaxReadiness, TaxFinding, TaxPeriodSummary, FeeImpact } from './tax.types';

export const taxService = {
  async getPeriods(projectId: string): Promise<TaxPeriodSummary[]> {
    const result = await pool.query(
      `SELECT COALESCE(tax_period, TO_CHAR(date, 'YYYY-MM')) AS period,
        COUNT(*) AS total_count,
        COUNT(*) FILTER (WHERE tax_review_status = 'ready') AS ready_count,
        COUNT(*) FILTER (WHERE tax_review_status = 'needs_review') AS needs_review_count,
        COUNT(*) FILTER (WHERE tax_review_status = 'blocked') AS blocked_count
       FROM expenses WHERE project_id = $1 AND status <> 'rejected'
       GROUP BY period ORDER BY period DESC`,
      [projectId],
    );
    return result.rows.map(r => ({
      period: r.period, totalCount: Number(r.total_count),
      readyCount: Number(r.ready_count), needsReviewCount: Number(r.needs_review_count),
      blockedCount: Number(r.blocked_count),
    }));
  },

  async recalculate(projectId: string, period: string): Promise<{ updated: number }> {
    const result = await pool.query(
      `SELECT * FROM expenses WHERE project_id = $1
       AND COALESCE(tax_period, TO_CHAR(date, 'YYYY-MM')) = $2 AND status <> 'rejected'`,
      [projectId, period],
    );
    let updated = 0;
    for (const row of result.rows as TaxExpenseRow[]) {
      const cls = classify(row);
      await pool.query(
        `UPDATE expenses SET vat_class=$1, vat_reason=$2, deductibility=$3,
         tax_review_status=$4, tax_review_reason=$5, updated_at=NOW() WHERE id=$6`,
        [cls.vatClass, cls.vatReason, cls.deductibility, cls.taxReviewStatus, cls.taxReviewReason, row.id],
      );
      updated++;
    }
    return { updated };
  },

  async getReadiness(projectId: string, period: string): Promise<TaxReadiness> {
    const result = await pool.query(
      `SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE tax_review_status = 'ready') AS ready,
        COUNT(*) FILTER (WHERE tax_review_status = 'needs_review') AS needs_review,
        COUNT(*) FILTER (WHERE tax_review_status = 'blocked') AS blocked,
        COUNT(*) FILTER (WHERE evidence_status = 'none') AS missing_evidence,
        COUNT(*) FILTER (WHERE ocr_quality IN ('poor','failed')) AS ocr_issues
       FROM expenses WHERE project_id = $1
       AND COALESCE(tax_period, TO_CHAR(date, 'YYYY-MM')) = $2 AND status <> 'rejected'`,
      [projectId, period],
    );
    const row = result.rows[0];
    const total = Number(row.total);
    const ready = Number(row.ready);
    const feeImpact = calcFeeImpact();
    return {
      projectId, period,
      readinessScore: total > 0 ? Math.round((ready / total) * 100) : 0,
      totalCount: total, readyCount: ready,
      needsReviewCount: Number(row.needs_review), blockedCount: Number(row.blocked),
      missingEvidenceCount: Number(row.missing_evidence), ocrIssueCount: Number(row.ocr_issues),
      estimatedMonthlySaving: feeImpact.monthlySaving, estimatedAnnualSaving: feeImpact.annualSaving,
    };
  },

  async getFindings(projectId: string, period: string): Promise<TaxFinding[]> {
    const result = await pool.query(
      `SELECT * FROM expenses WHERE project_id = $1
       AND COALESCE(tax_period, TO_CHAR(date, 'YYYY-MM')) = $2
       AND tax_review_status IN ('needs_review','blocked') AND status <> 'rejected'
       ORDER BY date DESC`,
      [projectId, period],
    );
    return generateFindings(result.rows as TaxExpenseRow[]);
  },

  getFeeImpact(): FeeImpact { return calcFeeImpact(); },

  async buildAccountantPacket(projectId: string, period: string): Promise<string> {
    const result = await pool.query(
      `SELECT * FROM expenses WHERE project_id=$1
       AND COALESCE(tax_period, TO_CHAR(date, 'YYYY-MM'))=$2 AND status <> 'rejected' ORDER BY date`,
      [projectId, period],
    );
    const expenses = result.rows as TaxExpenseRow[];
    return buildAccountantPacket(projectId, period, expenses, generateFindings(expenses));
  },

  async buildSelfFilingPacket(projectId: string, period: string): Promise<object> {
    const result = await pool.query(
      `SELECT * FROM expenses WHERE project_id=$1
       AND COALESCE(tax_period, TO_CHAR(date, 'YYYY-MM'))=$2 AND status <> 'rejected' ORDER BY date`,
      [projectId, period],
    );
    return buildSelfFilingPacket(projectId, period, result.rows as TaxExpenseRow[]);
  },

  // 세무사 전달 패킷 PDF (Buffer)
  async buildAccountantPacketPdf(projectId: string, period: string): Promise<Buffer> {
    const projectResult = await pool.query('SELECT name FROM projects WHERE id=$1', [projectId]);
    const projectName = projectResult.rows[0]?.name ?? projectId;
    const result = await pool.query(
      `SELECT * FROM expenses WHERE project_id=$1
       AND COALESCE(tax_period, TO_CHAR(date, 'YYYY-MM'))=$2 AND status <> 'rejected' ORDER BY date`,
      [projectId, period],
    );
    const expenses = result.rows as TaxExpenseRow[];
    return buildAccountantPacketPdf(projectName, period, expenses, generateFindings(expenses), calcFeeImpact());
  },

  // 직접신고용 CSV (홈택스 신용카드매출전표등 수령명세서 형식)
  async buildSelfFilingCsv(projectId: string, period: string): Promise<string> {
    const result = await pool.query(
      `SELECT * FROM expenses WHERE project_id=$1
       AND COALESCE(tax_period, TO_CHAR(date, 'YYYY-MM'))=$2 AND status <> 'rejected' ORDER BY date`,
      [projectId, period],
    );
    return buildSelfFilingCsv(result.rows as TaxExpenseRow[]);
  },

  async updateTaxReview(expenseId: string, updates: {
    taxReviewStatus?: string; taxReviewReason?: string; vatClass?: string;
    vatReason?: string; deductibility?: string; businessPurpose?: string;
    paymentMethod?: string; taxInvoiceType?: string;
  }) {
    const result = await pool.query(
      `UPDATE expenses SET
        tax_review_status = COALESCE($1, tax_review_status),
        tax_review_reason = COALESCE($2, tax_review_reason),
        vat_class         = COALESCE($3, vat_class),
        vat_reason        = COALESCE($4, vat_reason),
        deductibility     = COALESCE($5, deductibility),
        business_purpose  = COALESCE($6, business_purpose),
        payment_method    = COALESCE($7, payment_method),
        tax_invoice_type  = COALESCE($8, tax_invoice_type),
        updated_at        = NOW()
       WHERE id=$9 RETURNING *`,
      [updates.taxReviewStatus, updates.taxReviewReason, updates.vatClass, updates.vatReason,
       updates.deductibility, updates.businessPurpose, updates.paymentMethod, updates.taxInvoiceType, expenseId],
    );
    return result.rows[0] ?? null;
  },
};
