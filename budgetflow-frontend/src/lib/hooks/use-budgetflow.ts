"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveExpense,
  closeProject,
  confirmTemplateMapping,
  createBudgetCategory,
  createProject,
  getBudgetCategories,
  getExpenseSummary,
  getExpenses,
  getExportJobs,
  getProject,
  getProjects,
  getTaxFeeImpact,
  getTaxFindings,
  getTaxPeriods,
  getTaxReadiness,
  rejectExpense,
  deleteExpense,
  recalculateTaxPeriod,
  requestAccountantPacketExport,
  requestExpenseReportExport,
  requestSelfFilingPacketExport,
  uploadProjectTemplate,
  updateBudgetCategory,
  updateExpenseTaxReview,
} from "@/lib/api/budgetflow-api";
import type { ExpenseStatus, TaxExpenseReview, TaxFindingType } from "@/lib/domain";
import type {
  BudgetCategoryInput,
  BudgetCategoryUpdateInput,
} from "@/lib/forms/budget-category";
import type {
  ExpenseRejectInput,
  ExpenseReviewInput,
} from "@/lib/forms/expense-review";
import type { CreateProjectInput } from "@/lib/forms/project";
import type {
  ProjectTemplateUploadInput,
  TemplateMappingConfirmInput,
} from "@/lib/forms/template";

export const budgetflowQueryKeys = {
  projects: ["projects"] as const,
  project: (projectId: string) => ["project", projectId] as const,
  expensesByProject: (projectId: string) => ["expenses", projectId] as const,
  expenses: (projectId: string, status: ExpenseStatus | "all" = "all") =>
    ["expenses", projectId, status] as const,
  expenseSummary: (projectId: string) =>
    ["expense-summary", projectId] as const,
  budgetCategories: (projectId: string) =>
    ["budget-categories", projectId] as const,
  exportJobs: (projectId: string) => ["export-jobs", projectId] as const,
  taxPeriods: (projectId: string) => ["tax-periods", projectId] as const,
  taxReadiness: (projectId: string, period: string) =>
    ["tax-readiness", projectId, period] as const,
  taxFindings: (
    projectId: string,
    period: string,
    filter: TaxFindingType | "all" = "all",
  ) => ["tax-findings", projectId, period, filter] as const,
  taxFeeImpact: (projectId: string, period: string) =>
    ["tax-fee-impact", projectId, period] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: budgetflowQueryKeys.projects,
    queryFn: getProjects,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.projects,
      });
    },
  });
}

export function useCloseProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => closeProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.project(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.projects,
      });
    },
  });
}

export function useUploadProjectTemplate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProjectTemplateUploadInput) =>
      uploadProjectTemplate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.project(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.projects,
      });
    },
  });
}

export function useConfirmTemplateMapping(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TemplateMappingConfirmInput) =>
      confirmTemplateMapping(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.project(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.projects,
      });
    },
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: budgetflowQueryKeys.project(projectId),
    queryFn: () => getProject(projectId),
  });
}

export function useExpenses(
  projectId: string,
  status: ExpenseStatus | "all" = "all",
) {
  return useQuery({
    queryKey: budgetflowQueryKeys.expenses(projectId, status),
    queryFn: () => getExpenses({ projectId, status }),
    refetchInterval: 5_000,
  });
}

export function useApproveExpense(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ExpenseReviewInput) => approveExpense(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.expensesByProject(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.expenseSummary(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.budgetCategories(projectId),
      });
    },
  });
}

export function useRejectExpense(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ExpenseRejectInput) => rejectExpense(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.expensesByProject(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.expenseSummary(projectId),
      });
    },
  });
}

export function useDeleteExpense(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expenseId: string) => deleteExpense(expenseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.expensesByProject(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.expenseSummary(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.budgetCategories(projectId),
      });
    },
  });
}

export function useExpenseSummary(projectId: string) {
  return useQuery({
    queryKey: budgetflowQueryKeys.expenseSummary(projectId),
    queryFn: () => getExpenseSummary(projectId),
  });
}

export function useBudgetCategories(projectId: string) {
  return useQuery({
    queryKey: budgetflowQueryKeys.budgetCategories(projectId),
    queryFn: () => getBudgetCategories(projectId),
  });
}

export function useCreateBudgetCategory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BudgetCategoryInput) => createBudgetCategory(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.budgetCategories(projectId),
      });
    },
  });
}

export function useUpdateBudgetCategory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BudgetCategoryUpdateInput) =>
      updateBudgetCategory(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.budgetCategories(projectId),
      });
    },
  });
}

export function useExportJobs(projectId: string) {
  return useQuery({
    queryKey: budgetflowQueryKeys.exportJobs(projectId),
    queryFn: () => getExportJobs(projectId),
  });
}

export function useRequestExpenseReportExport(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => requestExpenseReportExport(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.exportJobs(projectId),
      });
    },
  });
}

export function useTaxPeriods(projectId: string) {
  return useQuery({
    queryKey: budgetflowQueryKeys.taxPeriods(projectId),
    queryFn: () => getTaxPeriods(projectId),
  });
}

export function useTaxReadiness(projectId: string, period: string) {
  return useQuery({
    enabled: Boolean(period),
    queryKey: budgetflowQueryKeys.taxReadiness(projectId, period),
    queryFn: () => getTaxReadiness(projectId, period),
  });
}

export function useTaxFindings(
  projectId: string,
  period: string,
  filter: TaxFindingType | "all" = "all",
) {
  return useQuery({
    enabled: Boolean(period),
    queryKey: budgetflowQueryKeys.taxFindings(projectId, period, filter),
    queryFn: () => getTaxFindings(projectId, period, filter),
  });
}

export function useTaxFeeImpact(projectId: string, period: string) {
  return useQuery({
    enabled: Boolean(period),
    queryKey: budgetflowQueryKeys.taxFeeImpact(projectId, period),
    queryFn: () => getTaxFeeImpact(projectId, period),
  });
}

function invalidateTaxPeriodQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  period: string,
) {
  void queryClient.invalidateQueries({
    queryKey: budgetflowQueryKeys.expensesByProject(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: budgetflowQueryKeys.taxPeriods(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: budgetflowQueryKeys.taxReadiness(projectId, period),
  });
  void queryClient.invalidateQueries({
    queryKey: ["tax-findings", projectId, period],
  });
  void queryClient.invalidateQueries({
    queryKey: budgetflowQueryKeys.taxFeeImpact(projectId, period),
  });
}

export function useRecalculateTaxPeriod(projectId: string, period: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => recalculateTaxPeriod(projectId, period),
    onSuccess: () => {
      invalidateTaxPeriodQueries(queryClient, projectId, period);
    },
  });
}

export function useUpdateExpenseTaxReview(projectId: string, period: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TaxExpenseReview) => updateExpenseTaxReview(input),
    onSuccess: () => {
      invalidateTaxPeriodQueries(queryClient, projectId, period);
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.expenseSummary(projectId),
      });
    },
  });
}

export function useRequestAccountantPacketExport(
  projectId: string,
  period: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => requestAccountantPacketExport(projectId, period),
    onSuccess: () => {
      invalidateTaxPeriodQueries(queryClient, projectId, period);
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.exportJobs(projectId),
      });
    },
  });
}

export function useRequestSelfFilingPacketExport(
  projectId: string,
  period: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => requestSelfFilingPacketExport(projectId, period),
    onSuccess: () => {
      invalidateTaxPeriodQueries(queryClient, projectId, period);
      void queryClient.invalidateQueries({
        queryKey: budgetflowQueryKeys.exportJobs(projectId),
      });
    },
  });
}
