import { describe, expect, it } from "vitest";

import {
  approveExpense,
  closeProject,
  createBudgetCategory,
  createProject,
  getBudgetCategories,
  getExportJobs,
  getExpenseSummary,
  getExpenses,
  getProject,
  getProjects,
  confirmTemplateMapping,
  rejectExpense,
  requestExpenseReportExport,
  uploadProjectTemplate,
  updateBudgetCategory,
} from "./budgetflow-api";

describe("BudgetFlow mock API", () => {
  it("returns projects sorted with active projects first", async () => {
    const projects = await getProjects();

    expect(projects.length).toBeGreaterThan(1);
    expect(projects[0]?.status).toBe("active");
    expect(projects.at(-1)?.status).toBe("closed");
  });

  it("creates an active project with normalized Slack channel metadata", async () => {
    const created = await createProject({
      organizationId: "org-gdgoc",
      name: "데모데이 정산",
      totalBudget: 700_000,
      slackChannelName: "#demoday-budget",
      templateFileName: "",
    });

    const projects = await getProjects();

    expect(created).toMatchObject({
      organizationId: "org-gdgoc",
      name: "데모데이 정산",
      totalBudget: 700_000,
      status: "active",
      slackChannelName: "demoday-budget",
      templateFileName: null,
      closedAt: null,
    });
    expect(projects[0]?.id).toBe(created.id);
  });

  it("rejects invalid project creation input", async () => {
    await expect(
      createProject({
        organizationId: "org-gdgoc",
        name: "",
        totalBudget: 0,
        slackChannelName: "",
        templateFileName: "",
      }),
    ).rejects.toThrow("프로젝트 생성 입력이 올바르지 않습니다.");
  });

  it("returns only project expenses and can filter by status", async () => {
    const allExpenses = await getExpenses({ projectId: "project-aingthon" });
    const needsReview = await getExpenses({
      projectId: "project-aingthon",
      status: "needs_review",
    });

    expect(allExpenses.length).toBeGreaterThan(needsReview.length);
    expect(allExpenses.every((expense) => expense.projectId === "project-aingthon")).toBe(
      true,
    );
    expect(needsReview.every((expense) => expense.status === "needs_review")).toBe(
      true,
    );
  });

  it("summarizes approved spending and review workload for a project", async () => {
    const summary = await getExpenseSummary("project-aingthon");

    expect(summary.totalExpenseCount).toBe(6);
    expect(summary.needsReviewCount).toBe(2);
    expect(summary.approvedAmount).toBe(538_500);
    expect(summary.missingEvidenceCount).toBe(1);
  });

  it("returns budget categories with usage derived from approved expenses", async () => {
    const categories = await getBudgetCategories("project-aingthon");
    const food = categories.find(
      (category) => category.name === "기업업무추진비",
    );

    expect(food).toMatchObject({
      budgetLimit: 800_000,
      approvedAmount: 158_000,
      remainingAmount: 642_000,
    });
  });

  it("creates a budget category with normalized keywords", async () => {
    const category = await createBudgetCategory({
      projectId: "project-aingthon",
      name: "강연비",
      budgetLimit: 150_000,
      keywords: [" 강연 ", "섭외", "강연"],
    });

    expect(category).toMatchObject({
      projectId: "project-aingthon",
      name: "강연비",
      budgetLimit: 150_000,
      keywords: ["강연", "섭외"],
      approvedAmount: 0,
      remainingAmount: 150_000,
      usageRate: 0,
    });
  });

  it("updates a budget category limit and keywords", async () => {
    const category = await updateBudgetCategory({
      categoryId: "cat-snack",
      name: "다과/음료비",
      budgetLimit: 260_000,
      keywords: ["다과", "음료", "커피"],
    });

    expect(category).toMatchObject({
      id: "cat-snack",
      name: "다과/음료비",
      budgetLimit: 260_000,
      keywords: ["다과", "음료", "커피"],
    });
  });

  it("uploads an excel template and suggests column mappings", async () => {
    const result = await uploadProjectTemplate({
      projectId: "project-aingthon",
      fileName: "법인운영비_최종_정산서.xlsx",
    });
    const project = await getProject("project-aingthon");

    expect(result).toMatchObject({
      projectId: "project-aingthon",
      fileName: "법인운영비_최종_정산서.xlsx",
      uploadStatus: "uploaded",
      mappingStatus: "suggested",
    });
    expect(result.mappings.map((mapping) => mapping.targetField)).toEqual(
      expect.arrayContaining(["transactionDate", "supplyAmount", "vatAmount"]),
    );
    expect(project).toMatchObject({
      templateFileName: "법인운영비_최종_정산서.xlsx",
      templateMappingStatus: "suggested",
    });
  });

  it("confirms suggested template mappings", async () => {
    const upload = await uploadProjectTemplate({
      projectId: "project-aingthon",
      fileName: "법인운영비_확정_정산서.xlsx",
    });
    const confirmed = await confirmTemplateMapping({
      projectId: "project-aingthon",
      mappings: upload.mappings,
    });
    const project = await getProject("project-aingthon");

    expect(confirmed.mappingStatus).toBe("confirmed");
    expect(confirmed.mappings.every((mapping) => mapping.confirmed)).toBe(true);
    expect(project?.templateMappingStatus).toBe("confirmed");
  });

  it("creates an export job with approved expenses and excludes review items", async () => {
    const exportJob = await requestExpenseReportExport("project-aingthon");
    const exportJobs = await getExportJobs("project-aingthon");

    expect(exportJob).toMatchObject({
      projectId: "project-aingthon",
      type: "expense_report",
      status: "completed",
      includedExpenseCount: 4,
      excludedReviewCount: 2,
    });
    expect(exportJob.downloadUrl).toContain(".xlsx");
    expect(exportJobs[0]?.id).toBe(exportJob.id);
  });

  it("updates review fields and approves a needs_review expense", async () => {
    const approved = await approveExpense({
      expenseId: "exp-005",
      date: "2026-05-15",
      amount: 84_000,
      categoryId: "cat-supply",
      description: "사무용품 구매 최종 확인",
    });

    expect(approved).toMatchObject({
      id: "exp-005",
      date: "2026-05-15",
      amount: 84_000,
      description: "사무용품 구매 최종 확인",
      status: "approved",
      reviewReason: null,
    });
  });

  it("rejects an expense with a review reason", async () => {
    const rejected = await rejectExpense({
      expenseId: "exp-006",
      reason: "예산 초과로 반려",
    });

    expect(rejected).toMatchObject({
      id: "exp-006",
      status: "rejected",
      reviewReason: "예산 초과로 반려",
    });
  });

  it("closes an active project manually", async () => {
    const closed = await closeProject("project-aingthon");
    const project = await getProject("project-aingthon");

    expect(closed).toMatchObject({
      id: "project-aingthon",
      status: "closed",
    });
    expect(closed.closedAt).not.toBeNull();
    expect(project?.status).toBe("closed");
  });
});
