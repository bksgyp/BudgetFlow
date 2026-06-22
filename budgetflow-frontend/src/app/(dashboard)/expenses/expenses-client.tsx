"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Download,
  FileWarning,
  Loader2,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  Callout,
  PageHeader,
  Panel,
  PriorityStep,
  PriorityStrip,
  SectionToolbar,
  SegmentedControl,
  StatusBadge,
} from "@/components/budgetflow-ui";
import { AnimatedExpenseList } from "@/components/expenses/animated-expense-list";
import { ApprovalConfirmDialog } from "@/components/expenses/approval-confirm-dialog";
import { ExpenseDetailModal } from "@/components/expenses/expense-detail-modal";
import { TextInput } from "@/components/form-controls";
import { SummaryCard } from "@/components/summary-card";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingState,
} from "@/components/dashboard-states";
import { Button } from "@/components/ui/button";
import type { Expense, ExpenseStatus, ExportJob, Project } from "@/lib/domain";
import {
  formatCurrency,
  formatDate,
  formatRelativeSeconds,
} from "@/lib/formatters";
import {
  useBudgetCategories,
  useCloseProject,
  useExpenses,
  useExpenseSummary,
  useExportJobs,
  useProject,
  useRequestExpenseReportExport,
} from "@/lib/hooks/use-budgetflow";
import { useSelectedProject } from "@/lib/hooks/use-selected-project";
import {
  evidenceStatusLabel,
  expenseStatusFilterOptions,
  expenseStatusLabel,
} from "@/lib/status";
import { evidenceStatusTone, expenseStatusTone } from "@/lib/status-tone";

export function ExpensesClient({
  projectId: routeProjectId,
}: {
  projectId?: string;
}) {
  const { selectedProjectId, setSelectedProjectId, isLoading, isError, refetch } =
    useSelectedProject();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId");
  const projectId = routeProjectId ?? queryProjectId ?? selectedProjectId;

  useEffect(() => {
    if (projectId && projectId !== selectedProjectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId, selectedProjectId, setSelectedProjectId]);

  if (projectId) {
    return <ExpensesClientInner projectId={projectId} />;
  }

  if (isLoading) {
    return (
      <DashboardLoadingState
        eyebrow="Expenses"
        lead="Slack 입력은 5초 간격으로 반영됩니다. 검토 사유 확인 후 승인 또는 반려합니다."
        title="지출 목록과 관리자 검토"
      />
    );
  }

  if (isError) {
    return (
      <DashboardErrorState
        eyebrow="Expenses"
        onRetry={refetch}
        title="지출 목록과 관리자 검토"
      />
    );
  }

  return (
    <DashboardEmptyState
      action={
        <Button asChild>
          <Link href="/projects">프로젝트 만들기</Link>
        </Button>
      }
      eyebrow="Expenses"
      lead="지출을 보려면 먼저 프로젝트가 필요합니다."
      title="지출 목록과 관리자 검토"
    >
      선택된 프로젝트가 없습니다. 프로젝트를 만들거나 사이드바에서 프로젝트를
      선택하세요.
    </DashboardEmptyState>
  );
}

function ExpensesClientInner({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<ExpenseStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null,
  );
  const [confirmVariant, setConfirmVariant] = useState<
    "close" | "export" | null
  >(null);
  const projectQuery = useProject(projectId);
  const allExpensesQuery = useExpenses(projectId, "all");
  const expensesQuery = useExpenses(projectId, status);
  const summaryQuery = useExpenseSummary(projectId);
  const categoriesQuery = useBudgetCategories(projectId);
  const exportJobsQuery = useExportJobs(projectId);
  const closeProjectMutation = useCloseProject(projectId);
  const requestExportMutation = useRequestExpenseReportExport(projectId);

  const categoryNameById = useMemo(
    () =>
      new Map(
        categoriesQuery.data?.map((category) => [category.id, category.name]) ??
          [],
      ),
    [categoriesQuery.data],
  );
  const isRefreshing = expensesQuery.isFetching && !expensesQuery.isLoading;
  const allExpenses = useMemo(
    () => allExpensesQuery.data ?? expensesQuery.data ?? [],
    [allExpensesQuery.data, expensesQuery.data],
  );
  const visibleExpenses = useMemo(() => {
    const expenses = expensesQuery.data ?? [];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return expenses;
    }

    return expenses.filter((expense) =>
      [
        expense.merchant,
        expense.description,
        expense.payerName,
        categoryNameById.get(expense.categoryId) ?? "",
        expense.reviewReason ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [categoryNameById, expensesQuery.data, searchQuery]);
  const filterCounts = useMemo(() => {
    const counts: Partial<Record<ExpenseStatus | "all", number>> = {
      all: allExpenses.length,
    };

    allExpenses.forEach((expense) => {
      counts[expense.status] = (counts[expense.status] ?? 0) + 1;
    });

    return counts;
  }, [allExpenses]);
  const effectiveSelectedExpenseId = selectedExpenseId;
  const selectedExpense =
    allExpenses.find((expense) => expense.id === selectedExpenseId) ?? null;
  const detailExpense =
    selectedExpense ??
    visibleExpenses.find((expense) => expense.evidenceStatus === "none") ??
    visibleExpenses.find((expense) => expense.status === "needs_review") ??
    visibleExpenses[0] ??
    null;
  const latestCompletedExport =
    exportJobsQuery.data?.find(
      (exportJob) => exportJob.status === "completed",
    ) ?? null;

  const closeProject = async () => {
    await closeProjectMutation.mutateAsync();
    setConfirmVariant(null);
  };

  const requestExport = async () => {
    await requestExportMutation.mutateAsync();
    setConfirmVariant(null);
  };

  return (
    <>
      <section className="bf-page-stack">
        <PageHeader
          actions={
            <>
              <Button
                disabled={expensesQuery.isFetching}
                onClick={() => void expensesQuery.refetch()}
                variant="outline"
              >
                {isRefreshing ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                수동 새로고침
              </Button>
              <LastUpdatedLabel
                dataUpdatedAt={expensesQuery.dataUpdatedAt}
                isRefreshing={isRefreshing}
              />
            </>
          }
          eyebrow="Expenses"
          lead="Slack 입력은 5초 간격으로 반영됩니다. 검토 사유 확인 후 승인 또는 반려합니다."
          title="지출 목록과 관리자 검토"
        />

        <div className="bf-card-grid" aria-label="지출 요약">
          <SummaryCard
            label="전체 지출"
            note="Slack 접수 기준 누적 건수"
            status={`${summaryQuery.data?.totalExpenseCount ?? 0}건`}
            value={formatCurrency(totalExpenseAmount(allExpenses))}
          />
          <SummaryCard
            label="승인 금액"
            note="엑셀 생성 대상에 포함"
            status={`${summaryQuery.data?.approvedCount ?? 0}건`}
            tone="success"
            value={formatCurrency(summaryQuery.data?.approvedAmount ?? 0)}
          />
          <SummaryCard
            label="검토 필요"
            note="신뢰도 낮음, 증빙 없음, 예산 초과 가능"
            status={`${summaryQuery.data?.needsReviewCount ?? 0}건`}
            tone="warning"
            value={`${summaryQuery.data?.needsReviewCount ?? 0}`}
          />
          <SummaryCard
            label="증빙 누락"
            note="영수증 없음은 무조건 관리자 검토"
            status={`${summaryQuery.data?.missingEvidenceCount ?? 0}건`}
            tone="danger"
            value={`${summaryQuery.data?.missingEvidenceCount ?? 0}`}
          />
        </div>

        <PriorityStrip aria-label="검토 작업 순서">
          <PriorityStep
            status="1순위"
            title="증빙 없는 지출 먼저 확인"
            tone="missing"
          >
            영수증 없음은 자동 승인하지 않고, 보완 요청 또는 반려를 먼저
            결정합니다.
          </PriorityStep>
          <PriorityStep
            status="2순위"
            title="금액 차이와 예산 초과 가능성 확인"
            tone="review"
          >
            AI 신뢰도와 검토 사유를 같은 패널에서 보고 필요한 필드만 수정합니다.
          </PriorityStep>
          <PriorityStep
            status="3순위"
            title="승인 항목만 엑셀 생성"
            tone="approved"
          >
            남은 검토 항목은 제외된다는 경고를 확인하고 제출용 파일을 만듭니다.
          </PriorityStep>
        </PriorityStrip>

        <section className="grid min-w-0 gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <Panel data-tour="expense-list">
              <div className="space-y-3 border-b border-[var(--bf-border-subtle)] p-4">
                <SectionToolbar
                  actions={
                    <label className="relative w-full sm:w-72">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-text-muted)]" />
                      <TextInput
                        aria-label="지출 검색"
                        className="h-9 pl-9"
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="사용처, 설명, 결제자 검색"
                        value={searchQuery}
                      />
                    </label>
                  }
                >
                  <SegmentedControl
                    ariaLabel="지출 상태 필터"
                    onChange={setStatus}
                    options={expenseStatusFilterOptions.map((option) => ({
                      ...option,
                      count: filterCounts[option.value] ?? 0,
                    }))}
                    value={status}
                  />
                </SectionToolbar>
                <p className="text-xs font-medium text-[var(--bf-text-secondary)]">
                  {visibleExpenses.length}건 표시 · 항목을 누르면 상세 검토
                  모달이 열립니다.
                </p>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] text-xs text-[var(--bf-text-secondary)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">날짜</th>
                      <th className="px-4 py-3 font-semibold">사용처 / 내용</th>
                      <th className="px-4 py-3 font-semibold">상태</th>
                      <th className="px-4 py-3 font-semibold">카테고리</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        금액
                      </th>
                      <th className="px-4 py-3 font-semibold">결제자</th>
                      <th className="px-4 py-3 font-semibold">증빙</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesQuery.isLoading ? (
                      <tr>
                        <td
                          className="px-4 py-8 text-center text-[var(--bf-text-secondary)]"
                          colSpan={7}
                        >
                          지출 내역을 불러오는 중입니다.
                        </td>
                      </tr>
                    ) : null}

                    {visibleExpenses.map((expense) => (
                      <ExpenseTableRow
                        categoryName={
                          categoryNameById.get(expense.categoryId) ?? "미분류"
                        }
                        expense={expense}
                        isSelected={expense.id === effectiveSelectedExpenseId}
                        key={expense.id}
                        onSelect={() => setSelectedExpenseId(expense.id)}
                      />
                    ))}

                    {visibleExpenses.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-8 text-center text-[var(--bf-text-secondary)]"
                          colSpan={7}
                        >
                          조건에 맞는 지출 내역이 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[var(--bf-border-subtle)] md:hidden">
                <AnimatedExpenseList listKey={`${status}-${searchQuery}`}>
                  {visibleExpenses.map((expense) => (
                    <ExpenseMobileCard
                      categoryName={
                        categoryNameById.get(expense.categoryId) ?? "미분류"
                      }
                      expense={expense}
                      isSelected={expense.id === effectiveSelectedExpenseId}
                      key={expense.id}
                      onSelect={() => setSelectedExpenseId(expense.id)}
                    />
                  ))}
                </AnimatedExpenseList>
              </div>
            </Panel>

            <ExportControls
              exportJob={latestCompletedExport}
              isClosing={closeProjectMutation.isPending}
              isExporting={requestExportMutation.isPending}
              needsReviewCount={summaryQuery.data?.needsReviewCount ?? 0}
              onCloseClick={() => setConfirmVariant("close")}
              onExportClick={() => {
                if ((summaryQuery.data?.needsReviewCount ?? 0) > 0) {
                  setConfirmVariant("export");
                  return;
                }

                void requestExport();
              }}
              project={projectQuery.data ?? null}
            />
          </div>
          <ExpenseReviewContextPanel
            categoryName={
              detailExpense
                ? categoryNameById.get(detailExpense.categoryId) ?? "미분류"
                : "미분류"
            }
            expense={detailExpense}
            onOpenDetail={() => {
              if (detailExpense) setSelectedExpenseId(detailExpense.id);
            }}
          />
        </section>
      </section>

      <ExpenseDetailModal
        categories={categoriesQuery.data ?? []}
        expense={selectedExpense}
        onClose={() => setSelectedExpenseId(null)}
        projectId={projectId}
      />

      <ApprovalConfirmDialog
        isPending={closeProjectMutation.isPending}
        onCancel={() => setConfirmVariant(null)}
        onConfirm={() => void closeProject()}
        open={confirmVariant === "close"}
        variant="close"
      />

      <ApprovalConfirmDialog
        excludeCount={summaryQuery.data?.needsReviewCount ?? 0}
        isPending={requestExportMutation.isPending}
        onCancel={() => setConfirmVariant(null)}
        onConfirm={() => void requestExport()}
        open={confirmVariant === "export"}
        variant="export"
      />
    </>
  );
}

function totalExpenseAmount(expenses: Expense[]) {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

function ExpenseTableRow({
  categoryName,
  expense,
  isSelected,
  onSelect,
}: {
  categoryName: string;
  expense: Expense;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const rowTone =
    expense.evidenceStatus === "none"
      ? "bg-[var(--bf-row-missing)] hover:bg-[var(--bf-support-error-bg)]"
      : expense.status === "needs_review"
        ? "bg-[var(--bf-row-review)] hover:bg-[var(--bf-support-warning-bg)]"
        : "hover:bg-[var(--bf-layer-hover)]";

  return (
    <tr
      aria-selected={isSelected}
      className={
        isSelected
          ? "cursor-pointer border-b border-[var(--bf-border-subtle)] bg-[var(--bf-layer-selected)] ring-1 ring-inset ring-black/10"
          : `cursor-pointer border-b border-[var(--bf-border-subtle)] transition-colors ${rowTone}`
      }
      onClick={onSelect}
    >
      <td className="whitespace-nowrap px-4 py-3">
        {formatDate(expense.date)}
      </td>
      <td className="max-w-[300px] px-4 py-3">
        <button
          aria-label={`${expense.merchant} 지출 상세 열기`}
          className="block max-w-full truncate rounded-md text-left font-semibold text-[var(--bf-text-primary)] transition-colors hover:text-[var(--bf-primary-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          type="button"
        >
          {expense.merchant}
        </button>
        <p className="mt-1 truncate text-[var(--bf-text-secondary)]">
          {expense.description}
        </p>
        {expense.reviewReason ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--bf-support-error-fg)]">
            <AlertTriangle className="size-3" />
            {expense.reviewReason}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <StatusBadge tone={expenseStatusTone[expense.status]}>
          {expenseStatusLabel[expense.status]}
        </StatusBadge>
      </td>
      <td className="px-4 py-3">{categoryName}</td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums">
        {formatCurrency(expense.amount)}
      </td>
      <td className="px-4 py-3">{expense.payerName}</td>
      <td className="px-4 py-3">
        <StatusBadge tone={evidenceStatusTone[expense.evidenceStatus]}>
          {expense.evidenceStatus === "none" ? (
            <FileWarning className="mr-1 size-3" />
          ) : null}
          {evidenceStatusLabel[expense.evidenceStatus]}
        </StatusBadge>
      </td>
    </tr>
  );
}

function ExportControls({
  exportJob,
  isClosing,
  isExporting,
  needsReviewCount,
  onCloseClick,
  onExportClick,
  project,
}: {
  exportJob: ExportJob | null;
  isClosing: boolean;
  isExporting: boolean;
  needsReviewCount: number;
  onCloseClick: () => void;
  onExportClick: () => void;
  project: Project | null;
}) {
  return (
    <Panel className="bf-panel-pad" data-tour="export-controls">
      <SectionToolbar
        actions={
          <>
            <Button
              disabled={isClosing || project?.status === "closed"}
              onClick={onCloseClick}
              variant="outline"
            >
              {isClosing ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Lock data-icon="inline-start" />
              )}
              정산 마감
            </Button>
            <Button disabled={isExporting} onClick={onExportClick}>
              {isExporting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              승인 항목만 엑셀 생성
            </Button>
          </>
        }
      >
        <h2 className="bf-panel-title">
          정산 마감 및 엑셀 생성
        </h2>
        <p className="bf-helper mt-1">
          검토 필요 항목이 남아 있어도 파일 생성은 가능하지만, 해당 항목은
          제외됩니다.
        </p>
      </SectionToolbar>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Callout
          action={
            <StatusBadge tone={needsReviewCount > 0 ? "review" : "approved"}>
              {needsReviewCount > 0 ? "제외 있음" : "준비 완료"}
            </StatusBadge>
          }
          title="생성 전 경고"
          tone={needsReviewCount > 0 ? "review" : "approved"}
        >
          검토 필요 {needsReviewCount}건은 생성 파일에서 제외됩니다.
        </Callout>
        <Callout
          action={
            exportJob?.downloadUrl ? (
              <Button asChild size="sm" variant="outline">
                <a
                  href={exportJob.downloadUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  다운로드
                </a>
              </Button>
            ) : null
          }
          title="최근 생성 파일"
          tone="default"
        >
          {exportJob
            ? `포함 ${exportJob.includedExpenseCount}건 · 제외 ${exportJob.excludedReviewCount}건`
            : "아직 현재 작업에서 생성된 파일 없음"}
        </Callout>
      </div>
    </Panel>
  );
}

function ExpenseReviewContextPanel({
  categoryName,
  expense,
  onOpenDetail,
}: {
  categoryName: string;
  expense: Expense | null;
  onOpenDetail: () => void;
}) {
  return (
    <aside className="hidden min-w-0 min-[1400px]:block">
      <div className="sticky top-7 space-y-4">
        <Panel className="p-4">
          {expense ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <StatusBadge tone={expenseStatusTone[expense.status]}>
                    {expenseStatusLabel[expense.status]}
                  </StatusBadge>
                  <h2 className="mt-3 truncate text-base font-semibold text-[var(--bf-text-primary)]">
                    {expense.merchant} 상세 검토
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--bf-text-secondary)]">
                    {expense.description}
                  </p>
                </div>
                <StatusBadge tone={evidenceStatusTone[expense.evidenceStatus]}>
                  {evidenceStatusLabel[expense.evidenceStatus]}
                </StatusBadge>
              </div>

              <dl className="mt-4 grid gap-3 text-sm">
                <ExpenseInfoRow label="날짜" value={formatDate(expense.date)} />
                <ExpenseInfoRow label="결제자" value={expense.payerName} />
                <ExpenseInfoRow label="카테고리" value={categoryName} />
                <ExpenseInfoRow
                  label="금액"
                  value={formatCurrency(expense.amount)}
                />
                <ExpenseInfoRow
                  label="AI 신뢰도"
                  value={`${Math.round(expense.aiConfidence * 100)}%`}
                />
              </dl>

              {expense.reviewReason ? (
                <div className="mt-4 rounded-lg border border-[var(--bf-support-warning-border)] bg-[var(--bf-support-warning-bg)] p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--bf-support-warning-fg)]" />
                    <p className="text-sm leading-6 text-[var(--bf-text-primary)]">
                      {expense.reviewReason}
                    </p>
                  </div>
                </div>
              ) : null}

              <Button className="mt-4 w-full" onClick={onOpenDetail}>
                상세 모달 열기
              </Button>
            </>
          ) : (
            <div className="py-8 text-center">
              <StatusBadge>대기</StatusBadge>
              <h2 className="mt-3 text-base font-semibold text-[var(--bf-text-primary)]">
                검토할 지출이 없습니다
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--bf-text-secondary)]">
                필터를 바꾸거나 Slack 접수 후 다시 확인하세요.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </aside>
  );
}

function ExpenseInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--bf-border-subtle)] pb-2 last:border-b-0 last:pb-0">
      <dt className="text-[var(--bf-text-secondary)]">{label}</dt>
      <dd className="text-right font-semibold text-[var(--bf-text-primary)]">
        {value}
      </dd>
    </div>
  );
}

function LastUpdatedLabel({
  dataUpdatedAt,
  isRefreshing,
}: {
  dataUpdatedAt: number;
  isRefreshing: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const updatedLabel = dataUpdatedAt
    ? formatRelativeSeconds(now - dataUpdatedAt)
    : "아직 갱신 전";

  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] px-3 text-sm font-medium text-[var(--bf-text-secondary)]">
      {isRefreshing ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <span className="bf-pulse" />
      )}
      마지막 갱신: {updatedLabel}
    </span>
  );
}

function ExpenseMobileCard({
  categoryName,
  expense,
  isSelected,
  onSelect,
}: {
  categoryName: string;
  expense: Expense;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={
        isSelected
          ? "block min-h-11 w-full bg-[var(--bf-layer-selected)] p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20"
          : expense.evidenceStatus === "none"
            ? "block min-h-11 w-full bg-[var(--bf-row-missing)] p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20"
            : expense.status === "needs_review"
              ? "block min-h-11 w-full bg-[var(--bf-row-review)] p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20"
              : "block min-h-11 w-full bg-[var(--bf-layer-01)] p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20"
      }
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--bf-text-muted)]">
            {formatDate(expense.date)}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-[var(--bf-text-primary)]">
            {expense.merchant}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--bf-text-secondary)]">
            {expense.description}
          </p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold tabular-nums">
          {formatCurrency(expense.amount)}
        </p>
      </div>
      {expense.reviewReason ? (
        <div className="mt-3 inline-flex max-w-full items-center gap-1 rounded-lg bg-[var(--bf-support-error-bg)] px-2 py-1 text-xs font-medium text-[var(--bf-support-error-fg)]">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="truncate">{expense.reviewReason}</span>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge>{categoryName}</StatusBadge>
        <StatusBadge>{expense.payerName}</StatusBadge>
        <StatusBadge tone={expenseStatusTone[expense.status]}>
          {expenseStatusLabel[expense.status]}
        </StatusBadge>
        <StatusBadge tone={evidenceStatusTone[expense.evidenceStatus]}>
          {evidenceStatusLabel[expense.evidenceStatus]}
        </StatusBadge>
      </div>
    </button>
  );
}
