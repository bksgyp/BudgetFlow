"use client";

import { useMemo, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from "lucide-react";

import Link from "next/link";

import {
  Callout,
  PageHeader,
  Panel,
  ProgressBar,
  SectionToolbar,
  StatusBadge,
} from "@/components/budgetflow-ui";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingState,
} from "@/components/dashboard-states";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
import type { Expense, TaxFinding } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useSelectedProject } from "@/lib/hooks/use-selected-project";
import {
  useExpenses,
  useRecalculateTaxPeriod,
  useRequestAccountantPacketExport,
  useRequestSelfFilingPacketExport,
  useTaxFeeImpact,
  useTaxFindings,
  useTaxPeriods,
  useTaxReadiness,
  useUpdateExpenseTaxReview,
} from "@/lib/hooks/use-budgetflow";

const taxReviewStatusLabel = {
  ready: "준비 완료",
  needs_review: "검토 필요",
  blocked: "신고 차단",
} as const;

const vatClassLabel = {
  vat_credit_candidate: "공제 후보",
  vat_non_credit_candidate: "불공제 검토",
  exempt_or_zero: "면세/영세",
  unknown: "미확인",
} as const;

const findingTone = {
  info: "processing",
  review: "review",
  blocking: "missing",
} as const;

export function TaxClient() {
  const { selectedProjectId, isLoading, isError, refetch } = useSelectedProject();

  if (selectedProjectId) {
    return <TaxClientInner projectId={selectedProjectId} />;
  }
  if (isLoading) {
    return (
      <DashboardLoadingState
        eyebrow="TaxOps"
        lead="세무 준비 현황을 불러오는 중입니다."
        title="세무 준비 대시보드"
      />
    );
  }
  if (isError) {
    return (
      <DashboardErrorState
        eyebrow="TaxOps"
        onRetry={refetch}
        title="세무 준비 대시보드"
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
      eyebrow="TaxOps"
      lead="세무 준비를 시작하려면 프로젝트가 필요합니다."
      title="세무 준비 대시보드"
    >
      선택된 프로젝트가 없습니다. 프로젝트를 만들거나 사이드바에서 프로젝트를
      선택하세요.
    </DashboardEmptyState>
  );
}

function TaxClientInner({ projectId }: { projectId: string }) {
  const periodsQuery = useTaxPeriods(projectId);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const period = selectedPeriod || periodsQuery.data?.[0]?.period || "";
  const readinessQuery = useTaxReadiness(projectId, period);
  const findingsQuery = useTaxFindings(projectId, period);
  const feeImpactQuery = useTaxFeeImpact(projectId, period);
  const expensesQuery = useExpenses(projectId, "all");
  const recalculateMutation = useRecalculateTaxPeriod(projectId, period);
  const updateTaxReviewMutation = useUpdateExpenseTaxReview(
    projectId,
    period,
  );
  const accountantExportMutation = useRequestAccountantPacketExport(
    projectId,
    period,
  );
  const selfFilingExportMutation = useRequestSelfFilingPacketExport(
    projectId,
    period,
  );

  const expenseById = useMemo(
    () =>
      new Map((expensesQuery.data ?? []).map((expense) => [expense.id, expense])),
    [expensesQuery.data],
  );
  const findings = findingsQuery.data ?? [];
  const readiness = readinessQuery.data;
  const feeImpact = feeImpactQuery.data;
  const isRefreshing =
    readinessQuery.isFetching || findingsQuery.isFetching || feeImpactQuery.isFetching;

  const markReady = async (expense: Expense) => {
    await updateTaxReviewMutation.mutateAsync({
      expenseId: expense.id,
      businessPurpose: expense.businessPurpose ?? expense.description,
      vatClass: expense.vatClass ?? "vat_credit_candidate",
      vatReason: expense.vatReason ?? "사업 관련 증빙 확인",
      deductibility: expense.deductibility ?? "business",
      taxReviewStatus: "ready",
      taxReviewReason: null,
    });
  };

  return (
    <section className="bf-page-stack">
      <PageHeader
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold text-[var(--bf-text-secondary)]">
              신고 기간
              <select
                className="h-11 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] px-3 text-sm font-semibold text-[var(--bf-text-primary)] shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-10"
                onChange={(event) => setSelectedPeriod(event.target.value)}
                value={period}
              >
                {(periodsQuery.data ?? []).map((taxPeriod) => (
                  <option key={taxPeriod.period} value={taxPeriod.period}>
                    {taxPeriod.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              className="h-11 sm:h-10"
              disabled={!period || recalculateMutation.isPending}
              onClick={() => void recalculateMutation.mutateAsync()}
              variant="outline"
            >
              {recalculateMutation.isPending ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              세무 준비도 재계산
            </Button>
          </div>
        }
        eyebrow="TaxOps"
        lead="반복 증빙 정리, VAT 후보 분류, 신고 준비 패킷 생성을 한 화면에서 처리합니다."
        title="세무 준비 대시보드"
      />

      <div className="bf-card-grid" aria-label="세무 준비 요약" data-tour="tax-readiness">
        <SummaryCard
          label="준비도 점수"
          note="차단 항목과 검토 큐를 반영"
          status={isRefreshing ? "갱신 중" : `${readiness?.score ?? 0}점`}
          tone={(readiness?.blockedCount ?? 0) > 0 ? "warning" : "success"}
          value={`${readiness?.score ?? 0}`}
        />
        <SummaryCard
          label="자동 처리 가능"
          note="반복 장부 정리 대체 후보"
          status={`${readiness?.readyCount ?? 0}건`}
          tone="success"
          value={`${readiness?.automatableRate ?? 0}%`}
        />
        <SummaryCard
          label="검토 필요"
          note="VAT, OCR, 사업 관련성 확인"
          status={`${readiness?.needsReviewCount ?? 0}건`}
          tone="warning"
          value={`${readiness?.needsReviewCount ?? 0}`}
        />
        <SummaryCard
          label="신고 차단"
          note="증빙 누락 또는 OCR 실패"
          status={`${readiness?.blockedCount ?? 0}건`}
          tone="danger"
          value={`${readiness?.missingEvidenceCount ?? 0}`}
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Panel className="bf-panel-pad">
          <SectionToolbar
            actions={
              <StatusBadge tone={(readiness?.blockedCount ?? 0) > 0 ? "review" : "approved"}>
                {readiness?.totalExpenseCount ?? 0}건 기준
              </StatusBadge>
            }
          >
            <h2 className="bf-panel-title">
              비용 절감 산식
            </h2>
            <p className="bf-helper mt-1">
              신고대행이 아니라 반복 세무 준비 업무 대체 효과만 표시합니다.
            </p>
          </SectionToolbar>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <FeeBox label="기존 월 비용" value={feeImpact?.currentMonthlyFee ?? 375_000} />
            <div className="hidden text-center text-sm font-semibold text-[var(--bf-text-muted)] sm:block" aria-hidden>
              →
            </div>
            <FeeBox
              label="BudgetFlow 적용 후"
              value={feeImpact?.budgetflowMonthlyFee ?? 301_400}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Callout title="월 절감액" tone="approved">
              {formatCurrency(feeImpact?.monthlySavings ?? 73_600)} 절감 · 연
              {formatCurrency(feeImpact?.annualSavings ?? 883_200)}
            </Callout>
            <Callout title="기준 가정" tone="default">
              월 기장료 {formatCurrency(feeImpact?.bookkeepingFee ?? 300_000)} +
              조정료 월 환산{" "}
              {formatCurrency(
                feeImpact?.corporateTaxAdjustmentMonthlyEquivalent ?? 75_000,
              )}
            </Callout>
          </div>
          <ul className="mt-3 grid gap-1 text-xs leading-5 text-[var(--bf-text-secondary)]">
            {(feeImpact?.assumptions ?? []).map((assumption) => (
              <li key={assumption}>· {assumption}</li>
            ))}
          </ul>
        </Panel>

        <Panel className="bf-panel-pad">
          <SectionToolbar>
            <h2 className="bf-panel-title">
              준비도 구성
            </h2>
            <p className="bf-helper mt-1">
              검토 큐가 줄면 준비도와 자동 처리 가능률이 올라갑니다.
            </p>
          </SectionToolbar>
          <div className="mt-4 space-y-4">
            <MetricBar label="준비도 점수" tone="approved" value={readiness?.score ?? 0} />
            <MetricBar
              label="자동 처리 가능률"
              tone="processing"
              value={readiness?.automatableRate ?? 0}
            />
            <MetricBar
              label="검토/차단 비중"
              tone={(readiness?.blockedCount ?? 0) > 0 ? "missing" : "review"}
              value={reviewShare(readiness)}
            />
          </div>
        </Panel>
      </section>

      <Panel>
        <div className="border-b border-[var(--bf-border-subtle)] p-4">
          <SectionToolbar
            actions={
              <StatusBadge tone={findings.length > 0 ? "review" : "approved"}>
                {findings.length}건
              </StatusBadge>
            }
          >
            <h2 className="bf-panel-title">
              세무 검토 큐
            </h2>
            <p className="bf-helper mt-1">
              증빙, VAT 후보, 사업 관련성 위험을 처리한 뒤 패킷에 포함합니다.
            </p>
          </SectionToolbar>
        </div>
        <TaxFindingTable
          expenseById={expenseById}
          findings={findings}
          isPending={updateTaxReviewMutation.isPending}
          onMarkReady={(expense) => void markReady(expense)}
        />
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="bf-panel-pad">
          <SectionToolbar
            actions={
              <>
                <Button
                  disabled={!period || accountantExportMutation.isPending}
                  onClick={() => void accountantExportMutation.mutateAsync()}
                  variant="outline"
                >
                  {accountantExportMutation.isPending ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <FileArchive data-icon="inline-start" />
                  )}
                  세무사 패킷 생성
                </Button>
                <Button
                  disabled={!period || selfFilingExportMutation.isPending}
                  onClick={() => void selfFilingExportMutation.mutateAsync()}
                >
                  {selfFilingExportMutation.isPending ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <FileSpreadsheet data-icon="inline-start" />
                  )}
                  직접신고 패킷 생성
                </Button>
              </>
            }
          >
            <h2 className="bf-panel-title">
              내보내기
            </h2>
            <p className="bf-helper mt-1">
              BudgetFlow는 신고대행이 아니라 신고 준비 자료를 생성합니다.
            </p>
          </SectionToolbar>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Callout title="세무사 전달 패킷" tone="default">
              증빙 목록, 검토 사유, VAT 후보, 제외 항목을 함께 묶습니다.
            </Callout>
            <Callout title="홈택스 직접 신고 준비" tone="processing">
              사용자 확인용 CSV와 차단 항목 체크리스트를 생성합니다.
            </Callout>
          </div>
        </Panel>

        <Panel className="bf-panel-pad">
          <SectionToolbar
            actions={<Calculator className="size-5 text-[var(--bf-text-muted)]" />}
          >
            <h2 className="bf-panel-title">
              검증 패널
            </h2>
            <p className="bf-helper mt-1">
              운영 지표가 아니라 OCR/검토 큐 설계 근거입니다.
            </p>
          </SectionToolbar>
          <div className="mt-4 grid gap-3">
            <ValidationRow label="합성 영수증 검증" value="720건" />
            <ValidationRow label="SROIE 공개 데이터셋" value="973건" />
            <ValidationRow
              label="검토 큐 유입 기준"
              value="증빙 누락, OCR 실패, VAT/개인 지출 위험"
            />
          </div>
        </Panel>
      </section>

      <p className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-4 py-3 text-xs leading-5 text-[var(--bf-text-muted)]">
        BudgetFlow는 세무 신고 대행 서비스가 아닙니다. VAT 공제 후보·세무 검토
        상태·비용 절감액은 확정된 세무 판단이 아니라 검토용 추정·후보이며, 최종
        계정과목 확정·세무조정·신고 및 세법 판단의 책임은 관할 세무사 또는 납세자
        본인에게 있습니다.
      </p>
    </section>
  );
}

function FeeBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] p-4">
      <p className="text-xs font-semibold text-[var(--bf-text-muted)]">{label}</p>
      <strong className="mt-2 block text-2xl font-semibold tabular-nums text-[var(--bf-text-primary)]">
        {formatCurrency(value)}
      </strong>
    </div>
  );
}

function MetricBar({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "approved" | "review" | "processing" | "missing";
  value: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[var(--bf-text-primary)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--bf-text-secondary)]">
          {value}%
        </span>
      </div>
      <ProgressBar label={label} tone={tone} value={value} />
    </div>
  );
}

function reviewShare(
  readiness:
    | {
        blockedCount: number;
        needsReviewCount: number;
        totalExpenseCount: number;
      }
    | undefined,
) {
  if (!readiness?.totalExpenseCount) return 0;
  return Math.round(
    ((readiness.needsReviewCount + readiness.blockedCount) /
      readiness.totalExpenseCount) *
      100,
  );
}

function TaxFindingTable({
  expenseById,
  findings,
  isPending,
  onMarkReady,
}: {
  expenseById: Map<string, Expense>;
  findings: TaxFinding[];
  isPending: boolean;
  onMarkReady: (expense: Expense) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="flex min-h-32 items-center justify-center gap-2 p-6 text-sm font-semibold text-[var(--bf-text-secondary)]">
        <CheckCircle2 className="size-4 text-[var(--bf-support-success)]" />
        현재 기간의 세무 검토 큐가 비어 있습니다.
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] text-xs text-[var(--bf-text-muted)]">
          <tr>
            <th className="px-4 py-3 font-semibold">지출</th>
            <th className="px-4 py-3 text-right font-semibold">금액</th>
            <th className="px-4 py-3 font-semibold">증빙</th>
            <th className="px-4 py-3 font-semibold">VAT 후보</th>
            <th className="px-4 py-3 font-semibold">위험 사유</th>
            <th className="px-4 py-3 font-semibold">처리</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((finding) => {
            const expense = expenseById.get(finding.expenseId);
            if (!expense) return null;

            return (
              <tr
                className="border-b border-[var(--bf-border-subtle)]"
                key={finding.id}
              >
                <td className="max-w-[260px] px-4 py-3">
                  <div className="font-semibold text-[var(--bf-text-primary)]">
                    {expense.merchant}
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--bf-text-secondary)]">
                    {formatDate(expense.date)} · {expense.description}
                  </p>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatCurrency(expense.amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={expense.evidenceStatus === "none" ? "missing" : "processing"}>
                    {expense.ocrQuality ?? "partial"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">
                  {vatClassLabel[expense.vatClass ?? "unknown"]}
                </td>
                <td className="max-w-[280px] px-4 py-3">
                  <StatusBadge tone={findingTone[finding.severity]}>
                    {taxReviewStatusLabel[expense.taxReviewStatus ?? "needs_review"]}
                  </StatusBadge>
                  <p className="mt-2 text-xs leading-5 text-[var(--bf-text-secondary)]">
                    {finding.description}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Button
                    disabled={isPending}
                    onClick={() => onMarkReady(expense)}
                    size="sm"
                    variant="outline"
                  >
                    준비 완료 처리
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="divide-y divide-[var(--bf-border-subtle)] md:hidden">
        {findings.map((finding) => {
          const expense = expenseById.get(finding.expenseId);
          if (!expense) return null;
          return (
            <div className="p-4" key={finding.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--bf-text-muted)]">
                    {formatDate(expense.date)}
                  </p>
                  <h4 className="mt-0.5 truncate text-sm font-semibold text-[var(--bf-text-primary)]">
                    {expense.merchant}
                  </h4>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--bf-text-primary)]">
                  {formatCurrency(expense.amount)}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[var(--bf-text-secondary)]">
                {finding.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge tone={findingTone[finding.severity]}>
                  {taxReviewStatusLabel[expense.taxReviewStatus ?? "needs_review"]}
                </StatusBadge>
                <StatusBadge
                  tone={expense.evidenceStatus === "none" ? "missing" : "processing"}
                >
                  {expense.ocrQuality ?? "partial"}
                </StatusBadge>
                <StatusBadge>
                  {vatClassLabel[expense.vatClass ?? "unknown"]}
                </StatusBadge>
              </div>
              <Button
                className="mt-3 w-full"
                disabled={isPending}
                onClick={() => onMarkReady(expense)}
                size="sm"
                variant="outline"
              >
                준비 완료 처리
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ValidationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-3 py-2">
      <span className="text-sm font-semibold text-[var(--bf-text-secondary)]">
        {label}
      </span>
      <span className="text-right text-sm font-semibold tabular-nums text-[var(--bf-text-primary)]">
        {value}
      </span>
    </div>
  );
}
