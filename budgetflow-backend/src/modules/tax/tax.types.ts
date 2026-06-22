export type TaxInvoiceType = 'card_receipt' | 'cash_receipt' | 'tax_invoice' | 'simple_receipt' | 'unknown';
export type PaymentMethod  = 'corporate_card' | 'personal_card' | 'cash' | 'transfer' | 'unknown';
export type VatClass       = 'vat_credit_candidate' | 'vat_non_credit_candidate' | 'exempt_or_zero' | 'unknown';
export type Deductibility  = 'business' | 'personal_risk' | 'mixed' | 'unknown';
export type TaxReviewStatus = 'ready' | 'needs_review' | 'blocked';
export type OcrQuality     = 'good' | 'partial' | 'poor' | 'failed';

export type FindingType =
  | 'missing_evidence' | 'ocr_failed' | 'ocr_poor'
  | 'missing_amount' | 'missing_date' | 'missing_merchant'
  | 'missing_business_purpose' | 'missing_payment_method'
  | 'personal_risk' | 'vat_review_needed';

export interface TaxExpenseRow {
  id: string;
  project_id: string;
  date: string | null;
  amount: number | null;
  merchant: string | null;
  description: string;
  category_id: string | null;
  status: string;
  evidence_status: string;
  ai_confidence: number;
  missing_fields: string[];
  review_reason: string | null;
  tax_invoice_type: TaxInvoiceType;
  payment_method: PaymentMethod;
  business_purpose: string | null;
  vat_class: VatClass;
  vat_reason: string | null;
  deductibility: Deductibility;
  tax_review_status: TaxReviewStatus;
  tax_review_reason: string | null;
  ocr_quality: OcrQuality;
  ocr_failure_mode: string | null;
  tax_period: string | null;
  slack_ts: string | null;
}

export interface TaxClassification {
  vatClass: VatClass;
  vatReason: string;
  deductibility: Deductibility;
  taxReviewStatus: TaxReviewStatus;
  taxReviewReason: string | null;
}

export interface TaxFinding {
  expenseId: string;
  date: string | null;
  merchant: string | null;
  amount: number | null;
  findingType: FindingType;
  severity: 'high' | 'medium' | 'low';
  vatClass: VatClass;
  reviewReason: string;
  suggestedActions: string[];
}

export interface TaxReadiness {
  projectId: string;
  period: string;
  readinessScore: number;
  totalCount: number;
  readyCount: number;
  needsReviewCount: number;
  blockedCount: number;
  missingEvidenceCount: number;
  ocrIssueCount: number;
  estimatedMonthlySaving: number;
  estimatedAnnualSaving: number;
}

export interface FeeImpact {
  baseMonthlyFee: number;
  targetMonthlyFee: number;
  monthlySaving: number;
  annualSaving: number;
  basis: string;
}

export interface TaxPeriodSummary {
  period: string;
  totalCount: number;
  readyCount: number;
  needsReviewCount: number;
  blockedCount: number;
}
