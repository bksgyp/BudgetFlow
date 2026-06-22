import type { TaxExpenseRow, TaxFinding, FindingType } from './tax.types';

function finding(
  row: TaxExpenseRow,
  findingType: FindingType,
  severity: TaxFinding['severity'],
  reviewReason: string,
  suggestedActions: string[],
): TaxFinding {
  return { expenseId: row.id, date: row.date, merchant: row.merchant, amount: row.amount, findingType, severity, vatClass: row.vat_class, reviewReason, suggestedActions };
}

export function generateFindings(rows: TaxExpenseRow[]): TaxFinding[] {
  const findings: TaxFinding[] = [];
  for (const row of rows) {
    if (!row.amount)
      findings.push(finding(row, 'missing_amount', 'high', '금액이 누락되어 세무 처리가 불가합니다.', ['영수증 재업로드', '금액 직접 입력']));
    if (!row.date)
      findings.push(finding(row, 'missing_date', 'high', '날짜가 누락되어 귀속월 처리가 불가합니다.', ['영수증 재업로드', '날짜 직접 입력']));
    if (!row.merchant)
      findings.push(finding(row, 'missing_merchant', 'medium', '상호가 누락되었습니다.', ['상호 직접 입력']));
    if (row.evidence_status === 'none')
      findings.push(finding(row, 'missing_evidence', 'high', '영수증 증빙이 첨부되지 않았습니다.', ['영수증 이미지 업로드']));
    if (row.ocr_quality === 'failed')
      findings.push(finding(row, 'ocr_failed', 'high', 'OCR이 완전히 실패했습니다. 이미지를 다시 업로드해 주세요.', ['고화질 이미지 재업로드']));
    else if (row.ocr_quality === 'poor')
      findings.push(finding(row, 'ocr_poor', 'medium', '이미지 품질이 낮아 OCR 결과를 신뢰하기 어렵습니다.', ['고화질 이미지 재업로드', '데이터 수기 확인']));
    if (!row.business_purpose)
      findings.push(finding(row, 'missing_business_purpose', 'medium', '업무 목적이 입력되지 않았습니다.', ['Slack에서 용도 추가 입력', '관리자 직접 입력']));
    if (row.payment_method === 'unknown')
      findings.push(finding(row, 'missing_payment_method', 'low', '결제수단을 확인할 수 없습니다.', ['결제수단 직접 입력']));
    if (row.deductibility === 'personal_risk')
      findings.push(finding(row, 'personal_risk', 'high', '개인성 지출로 의심됩니다. 세무사 확인이 필요합니다.', ['업무 목적 증빙 추가', '세무사 상담']));
    if (row.vat_class === 'unknown')
      findings.push(finding(row, 'vat_review_needed', 'medium', '증빙 유형을 확인할 수 없어 VAT 분류가 불가합니다.', ['증빙 유형 확인', '세금계산서 또는 영수증 종류 입력']));
  }
  return findings;
}
