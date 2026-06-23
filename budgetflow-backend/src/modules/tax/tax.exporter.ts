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


// 직접신고용 CSV — 국세청 '신용카드매출전표등 수령명세서(매입)' 항목 구조에 맞춤.
// 매입세액 공제용 적격증빙(세금계산서/카드·현금영수증) 명세를 사용자가 홈택스에 옮겨 적거나
// 업로드 전 검토할 수 있도록 정리한다. 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM + CRLF.
// 주의: 공급가액/세액은 공제 후보 건에 한해 부가세 10% 가정으로 분리한 '추정치'이며,
//       사업자등록번호는 우리 데이터에 없어 공란(사용자 보완)으로 둔다.
const vatClassLabelKo: Record<string, string> = {
  vat_credit_candidate: '공제대상(추정)',
  vat_non_credit_candidate: '불공제',
  exempt_or_zero: '면세/영세',
  unknown: '확인필요',
};

export function buildSelfFilingCsv(expenses: TaxExpenseRow[]): string {
  const ready = expenses.filter(e => e.tax_review_status === 'ready');
  const header = [
    '거래일자', '상호(거래처)', '사업자등록번호', '공급가액', '부가세액',
    '합계(공급대가)', '결제수단', '증빙유형', '공제구분',
  ];
  const esc = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = ready.map(e => {
    const total = Number(e.amount ?? 0);
    const credit = e.vat_class === 'vat_credit_candidate';
    // 공제 후보(카드/현금영수증·세금계산서)만 부가세 10% 가정으로 분리
    const supply = credit ? Math.round(total / 1.1) : total;
    const vat = credit ? total - supply : 0;
    return [
      String(e.date ?? '').slice(0, 10),
      e.merchant ?? '',
      '', // 사업자등록번호: 데이터 없음 → 사용자 보완
      supply,
      vat,
      total,
      e.payment_method ?? '',
      e.tax_invoice_type ?? '',
      vatClassLabelKo[e.vat_class ?? 'unknown'] ?? '확인필요',
    ].map(esc).join(',');
  });

  // \uFEFF: Excel(특히 한국어 Windows)이 UTF-8로 인식하도록 BOM 추가
  return '\uFEFF' + [header.join(','), ...rows].join('\r\n') + '\r\n';
}
