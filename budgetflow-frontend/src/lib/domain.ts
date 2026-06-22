export type ProjectStatus = "active" | "closed";

export type ExpenseStatus =
  | "created"
  | "processing"
  | "needs_review"
  | "approved"
  | "rejected"
  | "exported";

export type EvidenceStatus =
  | "none"
  | "uploaded"
  | "ocr_completed"
  | "ocr_failed"
  | "verified";

export type ExportStatus =
  | "requested"
  | "generating"
  | "completed"
  | "failed"
  | "expired";

export type TaxInvoiceType =
  | "card_receipt"
  | "cash_receipt"
  | "tax_invoice"
  | "simple_receipt"
  | "unknown";

export type PaymentMethod =
  | "corporate_card"
  | "personal_card"
  | "cash"
  | "transfer"
  | "unknown";

export type VatClass =
  | "vat_credit_candidate"
  | "vat_non_credit_candidate"
  | "exempt_or_zero"
  | "unknown";

export type Deductibility = "business" | "personal_risk" | "mixed" | "unknown";

export type TaxReviewStatus = "ready" | "needs_review" | "blocked";

export type OcrQuality = "good" | "partial" | "poor" | "failed";

export type OcrFailureMode =
  | "none"
  | "blurry"
  | "cropped"
  | "handwritten"
  | "low_resolution"
  | "amount_missing"
  | "merchant_missing"
  | "date_missing";

export type TaxPeriodStatus = "open" | "locked" | "exported";

export type TaxFindingType =
  | "missing_evidence"
  | "ocr_failure"
  | "vat_review"
  | "personal_risk"
  | "duplicate_risk"
  | "period_mismatch";

export type TaxFindingSeverity = "info" | "review" | "blocking";

export type TaxExportType =
  | "accountant_packet"
  | "self_filing_packet"
  | "vat_review_csv";

export type TemplateMappingStatus = "none" | "suggested" | "confirmed";

export type TemplateField =
  | "date"
  | "merchant"
  | "description"
  | "category"
  | "amount"
  | "payerName"
  | "evidence";

export type Organization = {
  id: string;
  name: string;
  slackWorkspaceId: string;
  createdAt: string;
};

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  totalBudget: number;
  status: ProjectStatus;
  slackChannelId: string;
  slackChannelName: string;
  templateFileName: string | null;
  templateMappingStatus: TemplateMappingStatus;
  createdAt: string;
  closedAt: string | null;
};

export type BudgetCategory = {
  id: string;
  projectId: string;
  name: string;
  budgetLimit: number;
  keywords: string[];
  approvedAmount: number;
  remainingAmount: number;
  usageRate: number;
  createdAt: string;
};

export type BudgetCategoryRecord = Omit<
  BudgetCategory,
  "approvedAmount" | "remainingAmount" | "usageRate"
>;

export type EvidenceFile = {
  id: string;
  projectId: string;
  expenseId: string;
  fileName: string;
  fileType: "image" | "pdf" | "xlsx";
  url: string;
  ocrStatus: EvidenceStatus;
  createdAt: string;
};

export type Expense = {
  id: string;
  projectId: string;
  categoryId: string;
  date: string;
  amount: number;
  merchant: string;
  description: string;
  payerName: string;
  inputChannel: "slack";
  slackUserId: string;
  status: ExpenseStatus;
  evidenceStatus: EvidenceStatus;
  evidenceFileId: string | null;
  aiConfidence: number;
  missingFields: string[];
  reviewReason: string | null;
  taxInvoiceType?: TaxInvoiceType | null;
  paymentMethod?: PaymentMethod | null;
  businessPurpose?: string | null;
  vatClass?: VatClass | null;
  vatReason?: string | null;
  deductibility?: Deductibility | null;
  taxReviewStatus?: TaxReviewStatus | null;
  taxReviewReason?: string | null;
  ocrQuality?: OcrQuality | null;
  ocrFailureMode?: OcrFailureMode | null;
  taxPeriod?: string | null;
  receiptImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExportJob = {
  id: string;
  projectId: string;
  type: "budget_plan" | "expense_report" | TaxExportType;
  status: ExportStatus;
  includedExpenseCount: number;
  excludedReviewCount: number;
  downloadUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type TaxPeriod = {
  projectId: string;
  period: string;
  label: string;
  status: TaxPeriodStatus;
  transactionCount: number;
  reviewCount: number;
  blockedCount: number;
  updatedAt: string;
};

export type TaxReadinessReport = {
  projectId: string;
  period: string;
  score: number;
  automatableRate: number;
  readyCount: number;
  needsReviewCount: number;
  blockedCount: number;
  missingEvidenceCount: number;
  totalExpenseCount: number;
  generatedAt: string;
};

export type TaxFinding = {
  id: string;
  projectId: string;
  period: string;
  expenseId: string;
  type: TaxFindingType;
  severity: TaxFindingSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  createdAt: string;
};

export type TaxFeeImpact = {
  projectId: string;
  period: string;
  currentMonthlyFee: number;
  budgetflowMonthlyFee: number;
  monthlySavings: number;
  annualSavings: number;
  bookkeepingFee: number;
  corporateTaxAdjustmentMonthlyEquivalent: number;
  assumptions: string[];
};

export type TaxExpenseReview = {
  expenseId: string;
  businessPurpose?: string | null;
  vatClass?: VatClass | null;
  vatReason?: string | null;
  deductibility?: Deductibility | null;
  taxReviewStatus: TaxReviewStatus;
  taxReviewReason?: string | null;
};

export type TaxExportJob = ExportJob & {
  type: TaxExportType;
};

export type ExpenseSummary = {
  projectId: string;
  totalExpenseCount: number;
  needsReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  missingEvidenceCount: number;
  approvedAmount: number;
};

export type TemplateMappingSuggestion = {
  sourceColumn: string;
  targetField: TemplateField;
  confidence: number;
  confirmed: boolean;
};

export type TemplateUploadResult = {
  projectId: string;
  fileName: string;
  uploadStatus: "uploaded";
  mappingStatus: Exclude<TemplateMappingStatus, "none">;
  mappings: TemplateMappingSuggestion[];
};
