import type { TaxExpenseRow, TaxClassification, VatClass, Deductibility, TaxReviewStatus } from './tax.types';

function isCoreFieldMissing(row: Partial<TaxExpenseRow>): boolean {
  return !row.amount || !row.date || !row.merchant;
}

function isOcrDegraded(row: Partial<TaxExpenseRow>): boolean {
  return row.ocr_quality === 'failed' || row.ocr_quality === 'poor';
}

function classifyVat(row: Partial<TaxExpenseRow>): { vatClass: VatClass; vatReason: string } {
  switch (row.tax_invoice_type) {
    case 'tax_invoice':
      return { vatClass: 'vat_credit_candidate', vatReason: '세금계산서 수취로 VAT 공제 후보입니다. 세무사 최종 확인 필요.' };
    case 'card_receipt':
    case 'cash_receipt':
      return { vatClass: 'vat_credit_candidate', vatReason: '카드/현금영수증으로 VAT 공제 후보입니다. 업무 목적 확인 필요.' };
    case 'simple_receipt':
      return { vatClass: 'vat_non_credit_candidate', vatReason: '간이영수증으로 VAT 공제가 어렵습니다.' };
    default:
      return { vatClass: 'unknown', vatReason: '증빙 유형을 확인할 수 없어 VAT 분류가 불가합니다.' };
  }
}

function classifyDeductibility(row: Partial<TaxExpenseRow>): Deductibility {
  if (!row.business_purpose) return 'unknown';
  const purpose = row.business_purpose.toLowerCase();
  const personalKeywords = ['개인', '사적', '가족', '취미', '여가'];
  if (personalKeywords.some(k => purpose.includes(k))) return 'personal_risk';
  return 'business';
}

function determineReviewStatus(
  row: Partial<TaxExpenseRow>,
  vatClass: VatClass,
  deductibility: Deductibility,
): { taxReviewStatus: TaxReviewStatus; taxReviewReason: string | null } {
  if (isCoreFieldMissing(row)) {
    return { taxReviewStatus: 'blocked', taxReviewReason: '금액, 날짜, 상호 중 필수 항목이 누락되어 세무 처리가 불가합니다.' };
  }
  const reasons: string[] = [];
  if (isOcrDegraded(row))              reasons.push('이미지 품질이 낮아 OCR 결과를 신뢰하기 어렵습니다.');
  if (!row.business_purpose)           reasons.push('업무 목적이 입력되지 않았습니다.');
  if (row.payment_method === 'unknown') reasons.push('결제수단을 확인할 수 없습니다.');
  if (vatClass === 'unknown')          reasons.push('증빙 유형을 확인할 수 없어 VAT 분류가 불가합니다.');
  if (deductibility === 'personal_risk') reasons.push('개인성 지출로 의심됩니다. 세무사 확인 필요.');
  if (reasons.length > 0) {
    return { taxReviewStatus: 'needs_review', taxReviewReason: reasons.join(' / ') };
  }
  return { taxReviewStatus: 'ready', taxReviewReason: null };
}

export function classify(row: Partial<TaxExpenseRow>): TaxClassification {
  const { vatClass, vatReason } = classifyVat(row);
  const deductibility = classifyDeductibility(row);
  const { taxReviewStatus, taxReviewReason } = determineReviewStatus(row, vatClass, deductibility);
  return { vatClass, vatReason, deductibility, taxReviewStatus, taxReviewReason };
}
