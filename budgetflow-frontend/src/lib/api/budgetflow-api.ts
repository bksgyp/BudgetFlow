import type {
  BudgetCategory,
  Expense,
  ExpenseStatus,
  ExpenseSummary,
  ExportJob,
  Project,
  TaxExpenseReview,
  TaxExportJob,
  TaxFeeImpact,
  TaxFinding,
  TaxFindingType,
  TaxPeriod,
  TaxReadinessReport,
  TemplateMappingSuggestion,
  TemplateUploadResult,
} from "@/lib/domain";
import {
  budgetCategorySchema,
  budgetCategoryUpdateSchema,
  type BudgetCategoryInput,
  type BudgetCategoryUpdateInput,
} from "@/lib/forms/budget-category";
import {
  expenseRejectSchema,
  expenseReviewSchema,
  type ExpenseRejectInput,
  type ExpenseReviewInput,
} from "@/lib/forms/expense-review";
import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/forms/project";
import {
  projectTemplateUploadSchema,
  templateMappingConfirmSchema,
  type ProjectTemplateUploadInput,
  type TemplateMappingConfirmInput,
} from "@/lib/forms/template";

import { downloadFile, http, isApiConfigured, isLiveDataEnabled, isTaxApiEnabled } from "./http-client";
import {
  mockBudgetCategories,
  mockExpenses,
  mockExportJobs,
  mockProjects,
} from "./mock-data";

// 데이터 소스: 백엔드가 준비되기 전까지는 mock이 기본이다(isLiveDataEnabled=false → 항상 mock).
// demoMode는 실데이터가 켜진 환경에서도 튜토리얼이 항상 채워진 mock 화면에서 진행되도록 강제한다.
let demoMode = false;

export function setDemoMode(on: boolean) {
  demoMode = on;
}

export function isDemoMode() {
  return demoMode;
}

/** 실제 백엔드 경로를 사용할지 여부 (실데이터 OFF이거나 데모 모드면 false → mock 경로) */
function liveApi() {
  return isApiConfigured && isLiveDataEnabled && !demoMode;
}

// ─── 백엔드 응답 타입 (http-client camelizeKeys 적용 후 기준) ─────────────────

type BackendProject = {
  id: string;
  name: string;
  status: "active" | "closed";
  createdAt?: string;
  closedAt?: string;
  totalBudget?: number;
  organizationId?: string;
  slackChannelId?: string;
  slackChannelName?: string;
  templateFileName?: string;
  templateMappingStatus?: string;
};

type BackendExpense = {
  id: string;
  projectId?: string;
  amount: number;
  status: string;
  merchant: string;
  payerName: string;
  categoryId?: string;
  date?: string;
  description?: string;
  reviewReason?: string;
  evidenceStatus?: string;
  aiConfidence?: number;
  missingFields?: string[];
  taxInvoiceType?: Expense["taxInvoiceType"];
  paymentMethod?: Expense["paymentMethod"];
  businessPurpose?: string | null;
  vatClass?: Expense["vatClass"];
  vatReason?: string | null;
  deductibility?: Expense["deductibility"];
  taxReviewStatus?: Expense["taxReviewStatus"];
  taxReviewReason?: string | null;
  ocrQuality?: Expense["ocrQuality"];
  ocrFailureMode?: Expense["ocrFailureMode"];
  taxPeriod?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type BackendCategory = {
  id: string;
  name: string;
  budgetLimit?: number;
  projectId?: string;
  keywords?: string[];
  createdAt?: string;
  approvedAmount?: number | string;
  remainingAmount?: number | string;
  usageRate?: number | string;
};

type BackendExpenseSummary = {
  totalExpenseCount?: number;
  needsReviewCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
  missingEvidenceCount?: number;
  approvedAmount?: number;
};

type BackendExportJob = {
  id?: string;
  jobId?: string;
  status: string;
  downloadUrl?: string;
  includedExpenseCount?: number | string;
  excludedReviewCount?: number | string;
  createdAt?: string;
};

type BackendTaxPeriod = Partial<TaxPeriod> & {
  period: string;
  // 백엔드 실제 응답 필드 별칭
  totalCount?: number;
  needsReviewCount?: number;
};

type BackendTaxReadinessReport = Partial<TaxReadinessReport> & {
  // 백엔드 실제 응답 필드 별칭
  readinessScore?: number;
  totalCount?: number;
};

type BackendTaxFinding = {
  id?: string;
  projectId?: string;
  period?: string;
  expenseId: string;
  type?: string;
  findingType?: string;
  severity?: string;
  title?: string;
  description?: string;
  reviewReason?: string;
  recommendedAction?: string;
  suggestedActions?: string[];
  createdAt?: string;
};

type BackendTaxFeeImpact = Partial<TaxFeeImpact> & {
  // 백엔드 실제 응답 필드 별칭
  baseMonthlyFee?: number;
  targetMonthlyFee?: number;
  monthlySaving?: number;
  annualSaving?: number;
  basis?: string;
};

// ─── 어댑터 ────────────────────────────────────────────────────────────────────

const FALLBACK_ORG_ID = "org_inha_cs_2026";

function toProject(r: BackendProject): Project {
  const now = new Date().toISOString();
  return {
    id: r.id,
    organizationId: r.organizationId ?? FALLBACK_ORG_ID,
    name: r.name,
    totalBudget: r.totalBudget ?? 0,
    status: r.status,
    slackChannelId: r.slackChannelId ?? "",
    slackChannelName: r.slackChannelName ?? "",
    templateFileName: r.templateFileName ?? null,
    templateMappingStatus:
      (r.templateMappingStatus as Project["templateMappingStatus"]) ?? "none",
    createdAt: r.createdAt ?? now,
    closedAt: r.closedAt ?? null,
  };
}

function toExpense(r: BackendExpense): Expense {
  const now = new Date().toISOString();
  return {
    id: r.id,
    projectId: r.projectId ?? "",
    categoryId: r.categoryId ?? "",
    date: r.date ?? now.slice(0, 10),
    amount: Number(r.amount),
    merchant: r.merchant,
    description: r.description ?? "",
    payerName: r.payerName,
    inputChannel: "slack",
    slackUserId: "",
    status: r.status as ExpenseStatus,
    evidenceStatus: (r.evidenceStatus as Expense["evidenceStatus"]) ?? "none",
    evidenceFileId: null,
    aiConfidence: Number(r.aiConfidence ?? 0),
    missingFields: r.missingFields ?? [],
    reviewReason: r.reviewReason ?? null,
    taxInvoiceType: r.taxInvoiceType ?? null,
    paymentMethod: r.paymentMethod ?? null,
    businessPurpose: r.businessPurpose ?? null,
    vatClass: r.vatClass ?? null,
    vatReason: r.vatReason ?? null,
    deductibility: r.deductibility ?? null,
    taxReviewStatus: r.taxReviewStatus ?? null,
    taxReviewReason: r.taxReviewReason ?? null,
    ocrQuality: r.ocrQuality ?? null,
    ocrFailureMode: r.ocrFailureMode ?? null,
    taxPeriod: r.taxPeriod ?? null,
    createdAt: r.createdAt ?? now,
    updatedAt: r.updatedAt ?? now,
  };
}

function toCategory(r: BackendCategory, projectId: string): BudgetCategory {
  const budgetLimit = Number(r.budgetLimit ?? 0);
  const approvedAmount = Number(r.approvedAmount ?? 0);
  const now = new Date().toISOString();
  return {
    id: r.id,
    projectId: r.projectId ?? projectId,
    name: r.name,
    budgetLimit,
    keywords: r.keywords ?? [],
    approvedAmount,
    remainingAmount: Number(r.remainingAmount ?? budgetLimit - approvedAmount),
    usageRate: Number(r.usageRate ?? 0),
    createdAt: r.createdAt ?? now,
  };
}

function toExpenseSummary(
  r: BackendExpenseSummary,
  projectId: string,
): ExpenseSummary {
  return {
    projectId,
    totalExpenseCount: Number(r.totalExpenseCount ?? 0),
    needsReviewCount: Number(r.needsReviewCount ?? 0),
    approvedCount: Number(r.approvedCount ?? 0),
    rejectedCount: Number(r.rejectedCount ?? 0),
    missingEvidenceCount: Number(r.missingEvidenceCount ?? 0),
    approvedAmount: Number(r.approvedAmount ?? 0),
  };
}

function toExportJob(r: BackendExportJob, projectId: string): ExportJob {
  const now = new Date().toISOString();
  return {
    id: r.id ?? r.jobId ?? `export-${Date.now()}`,
    projectId,
    type: "expense_report",
    status: r.status as ExportJob["status"],
    includedExpenseCount: Number(r.includedExpenseCount ?? 0),
    excludedReviewCount: Number(r.excludedReviewCount ?? 0),
    downloadUrl: r.downloadUrl ?? null,
    expiresAt: null,
    createdAt: r.createdAt ?? now,
  };
}

function toTaxPeriod(r: BackendTaxPeriod, projectId: string): TaxPeriod {
  const now = new Date().toISOString();
  return {
    projectId: r.projectId ?? projectId,
    period: r.period,
    label: r.label ?? formatTaxPeriodLabel(r.period),
    status: r.status ?? "open",
    transactionCount: Number(r.transactionCount ?? r.totalCount ?? 0),
    reviewCount: Number(r.reviewCount ?? r.needsReviewCount ?? 0),
    blockedCount: Number(r.blockedCount ?? 0),
    updatedAt: r.updatedAt ?? now,
  };
}

function toTaxReadinessReport(
  r: BackendTaxReadinessReport,
  projectId: string,
  period: string,
): TaxReadinessReport {
  const totalExpenseCount = Number(r.totalExpenseCount ?? r.totalCount ?? 0);
  const readyCount = Number(r.readyCount ?? 0);
  const needsReviewCount = Number(r.needsReviewCount ?? 0);
  const blockedCount = Number(r.blockedCount ?? 0);
  const score = Number(r.score ?? r.readinessScore ?? 0);
  const automatableRate = Number(
    r.automatableRate ??
      (totalExpenseCount > 0
        ? Math.round((readyCount / totalExpenseCount) * 100)
        : 0),
  );
  return {
    projectId: r.projectId ?? projectId,
    period: r.period ?? period,
    score,
    automatableRate,
    readyCount,
    needsReviewCount,
    blockedCount,
    missingEvidenceCount: Number(r.missingEvidenceCount ?? 0),
    totalExpenseCount,
    generatedAt: r.generatedAt ?? new Date().toISOString(),
  };
}

// 백엔드 finding 필드(별칭/이종 값)를 프론트 계약으로 매핑
function mapFindingSeverity(s?: string): TaxFinding["severity"] {
  if (s === "blocking" || s === "high") return "blocking";
  if (s === "info" || s === "low") return "info";
  return "review"; // review | medium | 기타
}

function mapFindingType(t?: string): TaxFinding["type"] {
  switch (t) {
    case "missing_evidence":
      return "missing_evidence";
    case "ocr_failed":
    case "ocr_poor":
    case "ocr_failure":
      return "ocr_failure";
    case "personal_risk":
      return "personal_risk";
    case "duplicate_risk":
      return "duplicate_risk";
    case "period_mismatch":
      return "period_mismatch";
    default:
      return "vat_review";
  }
}

const FINDING_TITLE: Record<TaxFinding["type"], string> = {
  missing_evidence: "증빙 누락",
  ocr_failure: "OCR 실패",
  vat_review: "VAT 후보 검토",
  personal_risk: "개인 지출 위험",
  duplicate_risk: "중복 의심",
  period_mismatch: "기간 불일치",
};

function toTaxFinding(
  r: BackendTaxFinding,
  projectId: string,
  period: string,
): TaxFinding {
  const type = mapFindingType(r.type ?? r.findingType);
  return {
    id: r.id ?? `tax-finding-${r.expenseId}`,
    projectId: r.projectId ?? projectId,
    period: r.period ?? period,
    expenseId: r.expenseId,
    type,
    severity: mapFindingSeverity(r.severity),
    title: r.title ?? FINDING_TITLE[type] ?? "세무 검토 필요",
    description: r.description ?? r.reviewReason ?? "",
    recommendedAction:
      r.recommendedAction ??
      r.suggestedActions?.[0] ??
      "검토 후 상태를 갱신하세요.",
    createdAt: r.createdAt ?? new Date().toISOString(),
  };
}

function toTaxFeeImpact(
  r: BackendTaxFeeImpact,
  projectId: string,
  period: string,
): TaxFeeImpact {
  const currentMonthlyFee = Number(
    r.currentMonthlyFee ?? r.baseMonthlyFee ?? 375_000,
  );
  const budgetflowMonthlyFee = Number(
    r.budgetflowMonthlyFee ?? r.targetMonthlyFee ?? 301_400,
  );
  const monthlySavings = Number(
    r.monthlySavings ?? r.monthlySaving ?? currentMonthlyFee - budgetflowMonthlyFee,
  );
  return {
    projectId: r.projectId ?? projectId,
    period: r.period ?? period,
    currentMonthlyFee,
    budgetflowMonthlyFee,
    monthlySavings,
    annualSavings: Number(r.annualSavings ?? r.annualSaving ?? monthlySavings * 12),
    bookkeepingFee: Number(r.bookkeepingFee ?? 300_000),
    corporateTaxAdjustmentMonthlyEquivalent: Number(
      r.corporateTaxAdjustmentMonthlyEquivalent ?? 75_000,
    ),
    assumptions:
      r.assumptions ??
      (r.basis
        ? [r.basis]
        : [
            "월 기장료 300,000원",
            "법인세 조정료 900,000원을 12개월로 배분",
            "반복 증빙 정리와 신고 준비 자료 생성 업무를 BudgetFlow가 대체",
          ]),
  };
}

// ─── Mock 헬퍼 ────────────────────────────────────────────────────────────────

type GetExpensesParams = {
  projectId: string;
  status?: ExpenseStatus | "all";
};

const mockTemplateMappings = new Map<string, TemplateMappingSuggestion[]>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function byNewestCreatedAt<T extends { createdAt: string }>(a: T, b: T) {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function normalizeSlackChannelName(slackChannelName: string) {
  return slackChannelName.trim().replace(/^#/, "");
}

function formatTaxPeriodLabel(period: string) {
  const [year, month] = period.split("-");
  return `${year}년 ${Number(month)}월`;
}

function approvedExpensesForProject(projectId: string) {
  return mockExpenses.filter(
    (expense) =>
      expense.projectId === projectId &&
      (expense.status === "approved" || expense.status === "exported"),
  );
}

function expensesForProject(projectId: string) {
  return mockExpenses.filter((expense) => expense.projectId === projectId);
}

function getExpenseTaxPeriod(expense: Expense) {
  return expense.taxPeriod ?? expense.date.slice(0, 7);
}

function taxExpensesForProjectPeriod(projectId: string, period: string) {
  return expensesForProject(projectId).filter(
    (expense) => getExpenseTaxPeriod(expense) === period,
  );
}

// 세무 기능은 아직 백엔드에 없어 항상 mock 시드로 동작한다.
// 실제 백엔드의 프로젝트 ID(mock에 없는 id)가 들어와도 데모 시드 프로젝트로 안전하게 대체한다.
function resolveMockTaxProjectId(projectId: string) {
  return mockProjects.some((project) => project.id === projectId)
    ? projectId
    : (mockProjects[0]?.id ?? projectId);
}

function inferTaxReviewStatus(expense: Expense): NonNullable<Expense["taxReviewStatus"]> {
  if (expense.taxReviewStatus) return expense.taxReviewStatus;
  if (expense.evidenceStatus === "none" || expense.evidenceStatus === "ocr_failed") {
    return "blocked";
  }
  if (expense.status === "needs_review" || expense.aiConfidence < 0.85) {
    return "needs_review";
  }
  return "ready";
}

function inferOcrQuality(expense: Expense): NonNullable<Expense["ocrQuality"]> {
  if (expense.ocrQuality) return expense.ocrQuality;
  if (expense.evidenceStatus === "ocr_failed") return "failed";
  if (expense.evidenceStatus === "uploaded" || expense.aiConfidence < 0.88) {
    return "partial";
  }
  return "good";
}

function inferVatClass(expense: Expense): NonNullable<Expense["vatClass"]> {
  if (expense.vatClass) return expense.vatClass;
  if (expense.evidenceStatus === "none") return "unknown";
  if (expense.merchant.includes("식당") || expense.merchant.includes("카페")) {
    return "vat_non_credit_candidate";
  }
  return "vat_credit_candidate";
}

function hydrateTaxExpense(expense: Expense): Expense {
  const taxReviewStatus = inferTaxReviewStatus(expense);
  const ocrQuality = inferOcrQuality(expense);
  const vatClass = inferVatClass(expense);

  return {
    ...expense,
    taxInvoiceType:
      expense.taxInvoiceType ??
      (expense.evidenceStatus === "none" ? "unknown" : "card_receipt"),
    paymentMethod: expense.paymentMethod ?? "corporate_card",
    businessPurpose: expense.businessPurpose ?? expense.description,
    vatClass,
    vatReason:
      expense.vatReason ??
      (vatClass === "vat_non_credit_candidate"
        ? "접대/식음료 성격 지출은 공제 가능 여부를 검토합니다."
        : "증빙과 사업 관련성이 확인되면 매입세액 공제 후보입니다."),
    deductibility:
      expense.deductibility ??
      (expense.status === "needs_review" ? "mixed" : "business"),
    taxReviewStatus,
    taxReviewReason:
      expense.taxReviewReason ??
      (taxReviewStatus === "blocked"
        ? "증빙 누락 또는 OCR 실패로 신고 준비 자료에서 차단됩니다."
        : taxReviewStatus === "needs_review"
          ? (expense.reviewReason ?? "세무 관점 추가 검토 필요")
          : null),
    ocrQuality,
    ocrFailureMode:
      expense.ocrFailureMode ??
      (expense.evidenceStatus === "none" ? "amount_missing" : "none"),
    taxPeriod: getExpenseTaxPeriod(expense),
  };
}

function buildMockTaxPeriods(projectId: string): TaxPeriod[] {
  const periodMap = new Map<string, Expense[]>();
  expensesForProject(projectId).forEach((expense) => {
    const period = getExpenseTaxPeriod(expense);
    periodMap.set(period, [...(periodMap.get(period) ?? []), expense]);
  });

  return [...periodMap.entries()]
    .map(([period, expenses]) => {
      const hydrated = expenses.map(hydrateTaxExpense);
      return {
        projectId,
        period,
        label: formatTaxPeriodLabel(period),
        status: "open" as const,
        transactionCount: expenses.length,
        reviewCount: hydrated.filter(
          (expense) => expense.taxReviewStatus === "needs_review",
        ).length,
        blockedCount: hydrated.filter(
          (expense) => expense.taxReviewStatus === "blocked",
        ).length,
        updatedAt:
          hydrated
            .map((expense) => expense.updatedAt)
            .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ??
          new Date().toISOString(),
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period));
}

function buildMockTaxReadiness(
  projectId: string,
  period: string,
): TaxReadinessReport {
  const expenses = taxExpensesForProjectPeriod(projectId, period).map(
    hydrateTaxExpense,
  );
  const totalExpenseCount = expenses.length;
  const readyCount = expenses.filter(
    (expense) => expense.taxReviewStatus === "ready",
  ).length;
  const needsReviewCount = expenses.filter(
    (expense) => expense.taxReviewStatus === "needs_review",
  ).length;
  const blockedCount = expenses.filter(
    (expense) => expense.taxReviewStatus === "blocked",
  ).length;
  const missingEvidenceCount = expenses.filter(
    (expense) => expense.evidenceStatus === "none",
  ).length;
  const score =
    totalExpenseCount === 0
      ? 0
      : Math.max(
          0,
          Math.round(
            ((readyCount + needsReviewCount * 0.55) / totalExpenseCount) * 100 -
              blockedCount * 8,
          ),
        );

  return {
    projectId,
    period,
    score,
    automatableRate:
      totalExpenseCount === 0
        ? 0
        : Math.round((readyCount / totalExpenseCount) * 100),
    readyCount,
    needsReviewCount,
    blockedCount,
    missingEvidenceCount,
    totalExpenseCount,
    generatedAt: new Date().toISOString(),
  };
}

function buildMockTaxFindings(projectId: string, period: string): TaxFinding[] {
  const typeByExpense = (expense: Expense): TaxFindingType => {
    if (expense.evidenceStatus === "none") return "missing_evidence";
    if (expense.ocrQuality === "failed") return "ocr_failure";
    if (expense.deductibility === "personal_risk") return "personal_risk";
    return "vat_review";
  };

  return taxExpensesForProjectPeriod(projectId, period)
    .map(hydrateTaxExpense)
    .filter((expense) => expense.taxReviewStatus !== "ready")
    .map((expense) => {
      const type = typeByExpense(expense);
      const severity = expense.taxReviewStatus === "blocked" ? "blocking" : "review";
      return {
        id: `tax-finding-${expense.id}`,
        projectId,
        period,
        expenseId: expense.id,
        type,
        severity,
        title:
          type === "missing_evidence"
            ? "증빙 누락"
            : type === "ocr_failure"
              ? "OCR 실패"
              : type === "personal_risk"
                ? "개인 지출 위험"
                : "VAT 후보 검토",
        description:
          expense.taxReviewReason ??
          expense.reviewReason ??
          "신고 준비 자료에 포함하기 전에 세무 검토가 필요합니다.",
        recommendedAction:
          severity === "blocking"
            ? "증빙을 보완하거나 신고 준비 패킷에서 제외하세요."
            : "사업 목적과 VAT 후보 사유를 확인한 뒤 준비 완료로 전환하세요.",
        createdAt: expense.updatedAt,
      };
    });
}

function buildMockTaxFeeImpact(projectId: string, period: string): TaxFeeImpact {
  return toTaxFeeImpact({}, projectId, period);
}

function approvedAmountByCategory(projectId: string) {
  return approvedExpensesForProject(projectId).reduce(
    (amountByCategory, expense) =>
      amountByCategory.set(
        expense.categoryId,
        (amountByCategory.get(expense.categoryId) ?? 0) + expense.amount,
      ),
    new Map<string, number>(),
  );
}

function findExpenseIndex(expenseId: string) {
  const expenseIndex = mockExpenses.findIndex(
    (expense) => expense.id === expenseId,
  );
  if (expenseIndex < 0) throw new Error("지출 항목을 찾을 수 없습니다.");
  return expenseIndex;
}

function findProjectIndex(projectId: string) {
  const projectIndex = mockProjects.findIndex(
    (project) => project.id === projectId,
  );
  if (projectIndex < 0) throw new Error("프로젝트를 찾을 수 없습니다.");
  return projectIndex;
}

function findBudgetCategoryIndex(categoryId: string) {
  const categoryIndex = mockBudgetCategories.findIndex(
    (category) => category.id === categoryId,
  );
  if (categoryIndex < 0) throw new Error("예산 카테고리를 찾을 수 없습니다.");
  return categoryIndex;
}

function normalizeKeywords(keywords: string[]) {
  return Array.from(
    new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean)),
  );
}

function hydrateBudgetCategory(
  category: (typeof mockBudgetCategories)[number],
  approvedAmounts = approvedAmountByCategory(category.projectId),
): BudgetCategory {
  const approvedAmount = approvedAmounts.get(category.id) ?? 0;
  return {
    ...category,
    approvedAmount,
    remainingAmount: category.budgetLimit - approvedAmount,
    usageRate:
      category.budgetLimit === 0
        ? 0
        : Math.round((approvedAmount / category.budgetLimit) * 1000) / 10,
  };
}

function createMockMappingSuggestions(): TemplateMappingSuggestion[] {
  return [
    {
      sourceColumn: "사용일자",
      targetField: "date",
      confidence: 0.94,
      confirmed: false,
    },
    {
      sourceColumn: "사용처",
      targetField: "merchant",
      confidence: 0.9,
      confirmed: false,
    },
    {
      sourceColumn: "내용",
      targetField: "description",
      confidence: 0.86,
      confirmed: false,
    },
    {
      sourceColumn: "예산항목",
      targetField: "category",
      confidence: 0.88,
      confirmed: false,
    },
    {
      sourceColumn: "금액",
      targetField: "amount",
      confidence: 0.97,
      confirmed: false,
    },
    {
      sourceColumn: "결제자",
      targetField: "payerName",
      confidence: 0.82,
      confirmed: false,
    },
    {
      sourceColumn: "증빙",
      targetField: "evidence",
      confidence: 0.76,
      confirmed: false,
    },
  ];
}

// ─── API 함수 ─────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  if (liveApi()) {
    const raw = await http.get<BackendProject[]>("/api/projects");
    return raw.map(toProject).sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return byNewestCreatedAt(a, b);
    });
  }

  const projects = [...mockProjects].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return byNewestCreatedAt(a, b);
  });
  return clone(projects);
}

export async function getProject(projectId: string): Promise<Project | null> {
  if (liveApi()) {
    const raw = await http.get<BackendProject>(`/api/projects/${projectId}`);
    return toProject(raw);
  }
  return clone(
    mockProjects.find((project) => project.id === projectId) ?? null,
  );
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const result = createProjectSchema.safeParse(input);
  if (!result.success)
    throw new Error("프로젝트 생성 입력이 올바르지 않습니다.");

  if (liveApi()) {
    const raw = await http.post<BackendProject>("/api/projects", {
      name: result.data.name.trim(),
      totalBudget: result.data.totalBudget,
      slackChannelName: normalizeSlackChannelName(result.data.slackChannelName),
      templateFileName: result.data.templateFileName?.trim() || null,
    });
    return toProject(raw);
  }

  const now = new Date().toISOString();
  const slackChannelName = normalizeSlackChannelName(
    result.data.slackChannelName,
  );
  const project: Project = {
    id: `project-${Date.now().toString(36)}`,
    organizationId: result.data.organizationId,
    name: result.data.name.trim(),
    totalBudget: result.data.totalBudget,
    status: "active",
    slackChannelId: `C-MOCK-${slackChannelName.toUpperCase()}`,
    slackChannelName,
    templateFileName: result.data.templateFileName?.trim() || null,
    templateMappingStatus: result.data.templateFileName?.trim()
      ? "suggested"
      : "none",
    createdAt: now,
    closedAt: null,
  };
  mockProjects.push(project);
  return clone(project);
}

export async function closeProject(projectId: string): Promise<Project> {
  if (liveApi()) {
    const raw = await http.post<BackendProject>(
      `/api/projects/${projectId}/close`,
      {},
    );
    return toProject(raw);
  }

  const projectIndex = findProjectIndex(projectId);
  const project: Project = {
    ...mockProjects[projectIndex],
    status: "closed",
    closedAt: new Date().toISOString(),
  };
  mockProjects[projectIndex] = project;
  return clone(project);
}

export async function uploadProjectTemplate(
  input: ProjectTemplateUploadInput,
): Promise<TemplateUploadResult> {
  const result = projectTemplateUploadSchema.safeParse(input);
  if (!result.success)
    throw new Error("엑셀 양식 업로드 입력이 올바르지 않습니다.");

  if (liveApi()) {
    await http.post(`/api/projects/${result.data.projectId}/template`, {
      fileName: result.data.fileName.trim(),
    });
    const mappings = createMockMappingSuggestions();
    return clone({
      projectId: result.data.projectId,
      fileName: result.data.fileName.trim(),
      uploadStatus: "uploaded" as const,
      mappingStatus: "suggested" as const,
      mappings,
    });
  }

  const projectIndex = findProjectIndex(result.data.projectId);
  const fileName = result.data.fileName.trim();
  const mappings = createMockMappingSuggestions();
  const project: Project = {
    ...mockProjects[projectIndex],
    templateFileName: fileName,
    templateMappingStatus: "suggested",
  };
  mockProjects[projectIndex] = project;
  mockTemplateMappings.set(project.id, mappings);
  return clone({
    projectId: project.id,
    fileName,
    uploadStatus: "uploaded" as const,
    mappingStatus: "suggested" as const,
    mappings,
  });
}

export async function confirmTemplateMapping(
  input: TemplateMappingConfirmInput,
): Promise<TemplateUploadResult> {
  const result = templateMappingConfirmSchema.safeParse(input);
  if (!result.success)
    throw new Error("엑셀 컬럼 매핑 입력이 올바르지 않습니다.");

  if (liveApi()) {
    await http.patch(
      `/api/projects/${result.data.projectId}/template-mapping`,
      {
        mappings: result.data.mappings,
      },
    );
    const mappings = result.data.mappings.map((m) => ({
      ...m,
      confirmed: true,
    }));
    return clone({
      projectId: result.data.projectId,
      fileName: "template.xlsx",
      uploadStatus: "uploaded" as const,
      mappingStatus: "confirmed" as const,
      mappings,
    });
  }

  const projectIndex = findProjectIndex(result.data.projectId);
  const project = mockProjects[projectIndex];
  const mappings = result.data.mappings.map((mapping) => ({
    ...mapping,
    confirmed: true,
  }));
  const updatedProject: Project = {
    ...project,
    templateMappingStatus: "confirmed",
  };
  mockProjects[projectIndex] = updatedProject;
  mockTemplateMappings.set(project.id, mappings);
  return clone({
    projectId: project.id,
    fileName: project.templateFileName ?? "template.xlsx",
    uploadStatus: "uploaded" as const,
    mappingStatus: "confirmed" as const,
    mappings,
  });
}

export async function getExpenses({
  projectId,
  status = "all",
}: GetExpensesParams): Promise<Expense[]> {
  if (liveApi()) {
    const params = new URLSearchParams({ projectId });
    if (status !== "all") params.set("status", status);
    const raw = await http.get<BackendExpense[]>(`/api/expenses?${params}`);
    return raw.map(toExpense).sort(byNewestCreatedAt);
  }

  const expenses = mockExpenses
    .filter((expense) => expense.projectId === projectId)
    .filter((expense) => status === "all" || expense.status === status)
    .map(hydrateTaxExpense)
    .sort(byNewestCreatedAt);
  return clone(expenses);
}

export async function approveExpense(
  input: ExpenseReviewInput,
): Promise<Expense> {
  const result = expenseReviewSchema.safeParse(input);
  if (!result.success) throw new Error("지출 검토 입력이 올바르지 않습니다.");

  if (liveApi()) {
    const raw = await http.patch<BackendExpense>(
      `/api/expenses/${result.data.expenseId}/approve`,
      {
        date: result.data.date,
        amount: result.data.amount,
        categoryId: result.data.categoryId,
        description: result.data.description.trim(),
      },
    );
    return toExpense(raw);
  }

  const expenseIndex = findExpenseIndex(result.data.expenseId);
  const current = mockExpenses[expenseIndex];
  const updated: Expense = {
    ...current,
    date: result.data.date,
    amount: result.data.amount,
    categoryId: result.data.categoryId,
    description: result.data.description.trim(),
    status: "approved",
    reviewReason: null,
    missingFields: current.missingFields.filter(
      (field) => field !== "reviewRequired",
    ),
    updatedAt: new Date().toISOString(),
  };
  mockExpenses[expenseIndex] = updated;
  return clone(updated);
}

export async function rejectExpense(
  input: ExpenseRejectInput,
): Promise<Expense> {
  const result = expenseRejectSchema.safeParse(input);
  if (!result.success) throw new Error("지출 반려 입력이 올바르지 않습니다.");

  if (liveApi()) {
    const raw = await http.patch<BackendExpense>(
      `/api/expenses/${result.data.expenseId}/reject`,
      { reason: result.data.reason?.trim() || "관리자 반려" },
    );
    return toExpense(raw);
  }

  const expenseIndex = findExpenseIndex(result.data.expenseId);
  const updated: Expense = {
    ...mockExpenses[expenseIndex],
    status: "rejected",
    reviewReason: result.data.reason?.trim() || "관리자 반려",
    updatedAt: new Date().toISOString(),
  };
  mockExpenses[expenseIndex] = updated;
  return clone(updated);
}

export async function getExpenseSummary(
  projectId: string,
): Promise<ExpenseSummary> {
  if (liveApi()) {
    const raw = await http.get<BackendExpenseSummary>(
      `/api/expenses/summary?projectId=${projectId}`,
    );
    return toExpenseSummary(raw, projectId);
  }

  const summary = expensesForProject(projectId).reduce(
    (accumulator, expense) => {
      accumulator.totalExpenseCount += 1;
      if (expense.status === "needs_review") accumulator.needsReviewCount += 1;
      if (expense.status === "approved") accumulator.approvedCount += 1;
      if (expense.status === "rejected") accumulator.rejectedCount += 1;
      if (expense.evidenceStatus === "none")
        accumulator.missingEvidenceCount += 1;
      if (expense.status === "approved" || expense.status === "exported") {
        accumulator.approvedAmount += expense.amount;
      }
      return accumulator;
    },
    {
      projectId,
      totalExpenseCount: 0,
      needsReviewCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      missingEvidenceCount: 0,
      approvedAmount: 0,
    } satisfies ExpenseSummary,
  );
  return { ...summary, projectId };
}

export async function getBudgetCategories(
  projectId: string,
): Promise<BudgetCategory[]> {
  if (liveApi()) {
    const raw = await http.get<BackendCategory[]>(
      `/api/budget-categories?projectId=${projectId}`,
    );
    return raw.map((r) => toCategory(r, projectId));
  }

  const approvedAmounts = approvedAmountByCategory(projectId);
  const categories = mockBudgetCategories
    .filter((category) => category.projectId === projectId)
    .map((category) => hydrateBudgetCategory(category, approvedAmounts));
  return clone(categories);
}

export async function createBudgetCategory(
  input: BudgetCategoryInput,
): Promise<BudgetCategory> {
  const result = budgetCategorySchema.safeParse(input);
  if (!result.success)
    throw new Error("예산 카테고리 입력이 올바르지 않습니다.");

  if (liveApi()) {
    const raw = await http.post<BackendCategory>("/api/budget-categories", {
      projectId: result.data.projectId,
      name: result.data.name.trim(),
      budgetLimit: result.data.budgetLimit,
      keywords: normalizeKeywords(result.data.keywords),
    });
    return toCategory(raw, result.data.projectId);
  }

  findProjectIndex(result.data.projectId);
  const category = {
    id: `cat-${Date.now().toString(36)}`,
    projectId: result.data.projectId,
    name: result.data.name.trim(),
    budgetLimit: result.data.budgetLimit,
    keywords: normalizeKeywords(result.data.keywords),
    createdAt: new Date().toISOString(),
  };
  mockBudgetCategories.push(category);
  return clone(hydrateBudgetCategory(category));
}

export async function updateBudgetCategory(
  input: BudgetCategoryUpdateInput,
): Promise<BudgetCategory> {
  const result = budgetCategoryUpdateSchema.safeParse(input);
  if (!result.success)
    throw new Error("예산 카테고리 입력이 올바르지 않습니다.");

  if (liveApi()) {
    const raw = await http.patch<BackendCategory>(
      `/api/budget-categories/${result.data.categoryId}`,
      {
        name: result.data.name.trim(),
        budgetLimit: result.data.budgetLimit,
        keywords: normalizeKeywords(result.data.keywords),
      },
    );
    return toCategory({ ...raw, id: result.data.categoryId }, "");
  }

  const categoryIndex = findBudgetCategoryIndex(result.data.categoryId);
  const current = mockBudgetCategories[categoryIndex];
  const category = {
    ...current,
    name: result.data.name.trim(),
    budgetLimit: result.data.budgetLimit,
    keywords: normalizeKeywords(result.data.keywords),
  };
  mockBudgetCategories[categoryIndex] = category;
  return clone(hydrateBudgetCategory(category));
}

export async function getExportJobs(projectId: string): Promise<ExportJob[]> {
  if (liveApi()) {
    const raw = await http.get<BackendExportJob[]>(
      `/api/projects/${projectId}/exports`,
    );
    return raw.map((r) => toExportJob(r, projectId)).sort(byNewestCreatedAt);
  }

  return clone(
    mockExportJobs
      .filter((exportJob) => exportJob.projectId === projectId)
      .sort(byNewestCreatedAt),
  );
}

export async function requestExpenseReportExport(
  projectId: string,
): Promise<ExportJob> {
  if (liveApi()) {
    await downloadFile(
      `/api/projects/${projectId}/exports/expense-report`,
      `expense-report-${projectId}.xlsx`,
    );
    const now = new Date().toISOString();
    return {
      id: `export-${Date.now()}`,
      projectId,
      type: "expense_report",
      status: "completed",
      includedExpenseCount: 0,
      excludedReviewCount: 0,
      downloadUrl: null,
      expiresAt: null,
      createdAt: now,
    };
  }

  findProjectIndex(projectId);
  const expenses = mockExpenses.filter(
    (expense) => expense.projectId === projectId,
  );
  const includedExpenseCount = expenses.filter(
    (expense) => expense.status === "approved" || expense.status === "exported",
  ).length;
  const excludedReviewCount = expenses.filter(
    (expense) => expense.status === "needs_review",
  ).length;
  const now = new Date();
  const exportJob: ExportJob = {
    id: `export-${Date.now().toString(36)}`,
    projectId,
    type: "expense_report",
    status: "completed",
    includedExpenseCount,
    excludedReviewCount,
    downloadUrl: `https://example.com/mock/${projectId}-expense-report.xlsx`,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
  };
  mockExportJobs.push(exportJob);
  return clone(exportJob);
}

export async function getTaxPeriods(projectId: string): Promise<TaxPeriod[]> {
  if (isTaxApiEnabled) {
    const raw = await http.get<BackendTaxPeriod[]>(
      `/api/projects/${projectId}/tax/periods`,
    );
    return raw.map((period) => toTaxPeriod(period, projectId));
  }

  return clone(buildMockTaxPeriods(resolveMockTaxProjectId(projectId)));
}

export async function recalculateTaxPeriod(
  projectId: string,
  period: string,
): Promise<TaxReadinessReport> {
  if (isTaxApiEnabled) {
    const raw = await http.post<BackendTaxReadinessReport>(
      `/api/projects/${projectId}/tax/periods/${period}/recalculate`,
      {},
    );
    return toTaxReadinessReport(raw, projectId, period);
  }

  return clone(
    buildMockTaxReadiness(resolveMockTaxProjectId(projectId), period),
  );
}

export async function getTaxReadiness(
  projectId: string,
  period: string,
): Promise<TaxReadinessReport> {
  if (isTaxApiEnabled) {
    const raw = await http.get<BackendTaxReadinessReport>(
      `/api/projects/${projectId}/tax/periods/${period}/readiness`,
    );
    return toTaxReadinessReport(raw, projectId, period);
  }

  return clone(
    buildMockTaxReadiness(resolveMockTaxProjectId(projectId), period),
  );
}

export async function getTaxFindings(
  projectId: string,
  period: string,
  filter: TaxFindingType | "all" = "all",
): Promise<TaxFinding[]> {
  if (isTaxApiEnabled) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    const query = params.toString();
    const raw = await http.get<BackendTaxFinding[]>(
      `/api/projects/${projectId}/tax/periods/${period}/findings${
        query ? `?${query}` : ""
      }`,
    );
    return raw.map((finding) => toTaxFinding(finding, projectId, period));
  }

  const findings = buildMockTaxFindings(
    resolveMockTaxProjectId(projectId),
    period,
  ).filter((finding) => filter === "all" || finding.type === filter);
  return clone(findings);
}

export async function getTaxFeeImpact(
  projectId: string,
  period: string,
): Promise<TaxFeeImpact> {
  if (isTaxApiEnabled) {
    const raw = await http.get<BackendTaxFeeImpact>(
      `/api/projects/${projectId}/tax/periods/${period}/fee-impact`,
    );
    return toTaxFeeImpact(raw, projectId, period);
  }

  return clone(
    buildMockTaxFeeImpact(resolveMockTaxProjectId(projectId), period),
  );
}

export async function updateExpenseTaxReview(
  input: TaxExpenseReview,
): Promise<Expense> {
  if (isTaxApiEnabled) {
    const raw = await http.patch<BackendExpense>(
      `/api/expenses/${input.expenseId}/tax-review`,
      {
        businessPurpose: input.businessPurpose?.trim() || null,
        vatClass: input.vatClass ?? null,
        vatReason: input.vatReason?.trim() || null,
        deductibility: input.deductibility ?? null,
        taxReviewStatus: input.taxReviewStatus,
        taxReviewReason: input.taxReviewReason?.trim() || null,
      },
    );
    return toExpense(raw);
  }

  const expenseIndex = findExpenseIndex(input.expenseId);
  const current = hydrateTaxExpense(mockExpenses[expenseIndex]);
  const updated: Expense = {
    ...current,
    businessPurpose: input.businessPurpose?.trim() || current.businessPurpose,
    vatClass: input.vatClass ?? current.vatClass,
    vatReason: input.vatReason?.trim() || current.vatReason,
    deductibility: input.deductibility ?? current.deductibility,
    taxReviewStatus: input.taxReviewStatus,
    taxReviewReason: input.taxReviewReason?.trim() || null,
    updatedAt: new Date().toISOString(),
  };
  mockExpenses[expenseIndex] = updated;
  return clone(updated);
}

function createMockTaxExport(
  projectId: string,
  period: string,
  type: TaxExportJob["type"],
  persist = true,
): TaxExportJob {
  const expenses = taxExpensesForProjectPeriod(projectId, period).map(
    hydrateTaxExpense,
  );
  const includedExpenseCount = expenses.filter(
    (expense) => expense.taxReviewStatus !== "blocked",
  ).length;
  const excludedReviewCount = expenses.filter(
    (expense) => expense.taxReviewStatus !== "ready",
  ).length;
  const now = new Date();
  const exportJob: TaxExportJob = {
    id: `tax-export-${Date.now().toString(36)}`,
    projectId,
    type,
    status: "completed",
    includedExpenseCount,
    excludedReviewCount,
    downloadUrl: `https://example.com/mock/${projectId}-${period}-${type}.xlsx`,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
  };
  if (persist) {
    mockExportJobs.push(exportJob);
  }
  return exportJob;
}

export async function requestAccountantPacketExport(
  projectId: string,
  period: string,
): Promise<TaxExportJob> {
  if (isTaxApiEnabled) {
    await downloadFile(
      `/api/projects/${projectId}/tax/periods/${period}/exports/accountant-packet`,
      `accountant-packet-${projectId}-${period}.xlsx`,
    );
    return createMockTaxExport(projectId, period, "accountant_packet", false);
  }

  return clone(
    createMockTaxExport(
      resolveMockTaxProjectId(projectId),
      period,
      "accountant_packet",
    ),
  );
}

export async function requestSelfFilingPacketExport(
  projectId: string,
  period: string,
): Promise<TaxExportJob> {
  if (isTaxApiEnabled) {
    await downloadFile(
      `/api/projects/${projectId}/tax/periods/${period}/exports/self-filing-packet`,
      `self-filing-packet-${projectId}-${period}.xlsx`,
    );
    return createMockTaxExport(projectId, period, "self_filing_packet", false);
  }

  return clone(
    createMockTaxExport(
      resolveMockTaxProjectId(projectId),
      period,
      "self_filing_packet",
    ),
  );
}
