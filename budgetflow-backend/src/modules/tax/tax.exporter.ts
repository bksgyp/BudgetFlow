import type { TaxExpenseRow, TaxFinding } from './tax.types';
import { calcFeeImpact } from './tax.fee-impact';

export function buildAccountantPacket(
  projectId: string,
  period: string,
  expenses: TaxExpenseRow[],
  findings: TaxFinding[],
): string {
  const feeImpact = calcFeeImpact();
  const ready   = expenses.filter(e => e.tax_review_status === 'ready');
  const review  = expenses.filter(e => e.tax_review_status === 'needs_review');
  const blocked = expenses.filter(e => e.tax_review_status === 'blocked');

  const lines: string[] = [
    '# BudgetFlow 세무사 전달 자료',
    `- 프로젝트: ${projectId}`,
    `- 기간: ${period}`,
    `- 생성일: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## 준비도 요약',
    '| 항목 | 건수 |', '|---|---|',
    `| 자동 처리 가능 | ${ready.length} |`,
    `| 검토 필요 | ${review.length} |`,
    `| 신고 차단 | ${blocked.length} |`,
    `| 전체 | ${expenses.length} |`,
    '',
    '## 비용 절감 효과',
    `- 기존 월 세무 비용: ${feeImpact.baseMonthlyFee.toLocaleString()}원`,
    `- BudgetFlow 적용 후: ${feeImpact.targetMonthlyFee.toLocaleString()}원`,
    `- 월 절감액: ${feeImpact.monthlySaving.toLocaleString()}원`,
    `- 연 절감액: ${feeImpact.annualSaving.toLocaleString()}원`,
    '',
    '## 검토 필요 항목 (High severity)',
  ];

  const highFindings = findings.filter(f => f.severity === 'high');
  if (highFindings.length === 0) {
    lines.push('없음');
  } else {
    for (const f of highFindings) {
      lines.push(`- [${f.expenseId}] ${f.merchant ?? '상호 미확인'} / ${f.amount != null ? f.amount.toLocaleString() + '원' : '-'} / ${f.findingType}: ${f.reviewReason}`);
    }
  }

  lines.push('', '## 지출 원장 (준비 완료)');
  lines.push('| 날짜 | 상호 | 금액 | 증빙유형 | 결제수단 | VAT분류 |');
  lines.push('|---|---|---|---|---|---|');
  for (const e of ready) {
    lines.push(`| ${e.date} | ${e.merchant} | ${e.amount != null ? e.amount.toLocaleString() + '원' : '-'} | ${e.tax_invoice_type} | ${e.payment_method} | ${e.vat_class} |`);
  }

  lines.push('', '> 이 자료는 세무 신고 준비용 참고 자료입니다. 최종 신고는 세무사를 통해 진행하세요.');
  return lines.join('\n');
}

export function buildSelfFilingPacket(
  projectId: string,
  period: string,
  expenses: TaxExpenseRow[],
): object {
  const ready = expenses.filter(e => e.tax_review_status === 'ready');
  const feeImpact = calcFeeImpact();
  return {
    type: 'self_filing_packet',
    projectId, period,
    generatedAt: new Date().toISOString(),
    summary: {
      totalReady:    ready.length,
      totalAmount:   ready.reduce((s, e) => s + (e.amount ?? 0), 0),
      vatCandidates: ready.filter(e => e.vat_class === 'vat_credit_candidate').length,
    },
    feeImpact,
    items: ready.map(e => ({
      id: e.id, date: e.date, merchant: e.merchant, amount: e.amount,
      taxInvoiceType: e.tax_invoice_type, paymentMethod: e.payment_method,
      vatClass: e.vat_class, vatReason: e.vat_reason,
      businessPurpose: e.business_purpose, deductibility: e.deductibility,
    })),
    notice: '이 자료는 세무 신고 준비용 참고 자료입니다. 최종 신고는 세무사 또는 홈택스를 통해 진행하세요.',
  };
}
