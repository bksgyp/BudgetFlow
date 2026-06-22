"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  FileWarning,
  FolderKanban,
  ReceiptText,
  Settings2,
  TrendingDown,
} from "lucide-react";
import { useMemo } from "react";

import {
  Callout,
  PageHeader,
  Panel,
  PriorityStep,
  PriorityStrip,
  SectionToolbar,
  StatusBadge,
} from "@/components/budgetflow-ui";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
import type { Expense } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  useExpenses,
  useExpenseSummary,
  useTaxFeeImpact,
  useTaxPeriods,
  useTaxReadiness,
} from "@/lib/hooks/use-budgetflow";
import { useSelectedProject } from "@/lib/hooks/use-selected-project";
import { projectExpensesHref } from "@/lib/routes";
import { expenseStatusLabel } from "@/lib/status";
import { expenseStatusTone } from "@/lib/status-tone";

export function HomeClient() {
  const { projects, selectedProjectId, isLoading } = useSelectedProject();

  if (isLoading && projects.length === 0) {
    return (
      <section className="bf-page-stack">
        <PageHeader
          eyebrow="Home"
          lead="프로젝트와 세무 준비 현황을 불러오는 중입니다."
          title="오늘의 정산·세무 현황"
        />
        <Panel className="bf-panel-pad">
          <p className="bf-helper">데이터를 불러오는 중입니다.</p>
        </Panel>
      </section>
    );
  }

  if (!selectedProjectId) {
    return (
      <section className="bf-page-stack">
        <PageHeader
          actions={
            <Button asChild>
              <Link href="/projects">
                <FolderKanban data-icon="inline-start" />
                프로젝트 만들기
              </Link>
            </Button>
          }
          eyebrow="Home"
          lead="아직 연결된 프로젝트가 없습니다. 프로젝트를 만들고 Slack 채널을 연결하면 정산과 세무 준비가 시작됩니다."
          title="BudgetFlow 시작하기"
        />
        <Panel className="bf-panel-pad">
          <p className="bf-helper">
            프로젝트를 생성하면 지출 수집, 검토, 세무 준비 현황이 이 화면에
            모입니다.
          </p>
        </Panel>
      </section>
    );
  }

  return <HomeClientInner projectId={selectedProjectId} />;
}

function HomeClientInner({ projectId }: { projectId: string }) {
  const { projects } = useSelectedProject();
  const summaryQuery = useExpenseSummary(projectId);
  const reviewExpensesQuery = useExpenses(projectId, "needs_review");
  const periodsQuery = useTaxPeriods(projectId);
  const period = periodsQuery.data?.[0]?.period ?? "";
  const readinessQuery = useTaxReadiness(projectId, period);
  const feeImpactQuery = useTaxFeeImpact(projectId, period);

  const summary = summaryQuery.data;
  const readiness = readinessQuery.data;
  const feeImpact = feeImpactQuery.data;
  const selectedProject = projects.find((project) => project.id === projectId);

  const reviewQueue = useMemo(
    () => (reviewExpensesQuery.data ?? []).slice(0, 5),
    [reviewExpensesQuery.data],
  );

  const expensesHref = projectExpensesHref(projectId);

  return (
    <section className="bf-page-stack">
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/tax">
                <Calculator data-icon="inline-start" />
                세무 준비 열기
              </Link>
            </Button>
            <Button asChild>
              <Link href={expensesHref}>
                검토 큐 열기
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </>
        }
        eyebrow="Home"
        lead={
          selectedProject
            ? `${selectedProject.name} · #${selectedProject.slackChannelName} 기준 오늘 먼저 볼 정산과 세무 준비 상태입니다.`
            : "오늘 먼저 볼 정산과 세무 준비 상태입니다."
        }
        title="오늘의 정산·세무 현황"
      />

      <div className="bf-card-grid" aria-label="오늘의 핵심 지표">
        <SummaryCard
          icon={<AlertTriangle className="size-4" />}
          label="검토 필요"
          note="신뢰도 낮음·증빙 없음·예산 초과 가능"
          status={`${summary?.needsReviewCount ?? 0}건`}
          tone="warning"
          value={`${summary?.needsReviewCount ?? 0}`}
        />
        <SummaryCard
          icon={<FileWarning className="size-4" />}
          label="증빙 누락"
          note="영수증 없음은 무조건 관리자 검토"
          status={`${summary?.missingEvidenceCount ?? 0}건`}
          tone="danger"
          value={`${summary?.missingEvidenceCount ?? 0}`}
        />
        <SummaryCard
          icon={<FileSpreadsheet className="size-4" />}
          label="승인 금액"
          note="엑셀·세무 패킷 생성 대상"
          status={`${summary?.approvedCount ?? 0}건`}
          tone="success"
          value={formatCurrency(summary?.approvedAmount ?? 0)}
        />
        <SummaryCard
          icon={<Calculator className="size-4" />}
          label="세무 준비도"
          note="신고 차단·검토 큐 반영 점수"
          status={`자동처리 ${readiness?.automatableRate ?? 0}%`}
          tone={(readiness?.blockedCount ?? 0) > 0 ? "warning" : "success"}
          value={`${readiness?.score ?? 0}점`}
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <Panel className="bf-panel-pad">
          <SectionToolbar
            actions={
              <Button asChild size="sm" variant="outline">
                <Link href={expensesHref}>
                  전체 보기
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            }
          >
            <h2 className="bf-panel-title">검토 큐 미리보기</h2>
            <p className="bf-helper mt-1">
              먼저 처리할 검토 필요 항목입니다. 항목을 열어 승인 또는 반려를
              결정하세요.
            </p>
          </SectionToolbar>

          <div className="mt-4 divide-y divide-[var(--bf-border-subtle)]">
            {reviewExpensesQuery.isLoading ? (
              <p className="py-5 text-sm text-[var(--bf-text-secondary)]">
                검토 큐를 불러오는 중입니다.
              </p>
            ) : reviewQueue.length === 0 ? (
              <div className="flex min-h-28 items-center justify-center gap-2 text-sm font-medium text-[var(--bf-text-secondary)]">
                <CheckCircle2 className="size-4 text-[var(--bf-support-success)]" />
                검토 필요 항목이 없습니다. 승인 항목으로 정산을 진행하세요.
              </div>
            ) : (
              reviewQueue.map((expense) => (
                <ReviewQueueRow expense={expense} key={expense.id} />
              ))
            )}
          </div>
        </Panel>

        <Panel className="bf-panel-pad">
          <SectionToolbar
            actions={<TrendingDown className="size-5 text-[var(--bf-support-success)]" />}
          >
            <h2 className="bf-panel-title">세무 비용 절감 효과</h2>
            <p className="bf-helper mt-1">
              반복 세무 준비 업무를 대체해 줄어드는 비용입니다. 신고대행이
              아닙니다.
            </p>
          </SectionToolbar>

          <div className="mt-4 space-y-3">
            <Callout title="이번 달 절감액" tone="approved">
              {formatCurrency(feeImpact?.monthlySavings ?? 73_600)} 절감 · 연{" "}
              {formatCurrency(feeImpact?.annualSavings ?? 883_200)}
            </Callout>
            <div className="grid grid-cols-2 gap-3">
              <FigureBox
                label="기존 월 비용"
                value={formatCurrency(feeImpact?.currentMonthlyFee ?? 375_000)}
              />
              <FigureBox
                label="적용 후"
                tone="primary"
                value={formatCurrency(
                  feeImpact?.budgetflowMonthlyFee ?? 301_400,
                )}
              />
            </div>
            <Button asChild className="w-full" variant="outline">
              <Link href="/tax">
                <Calculator data-icon="inline-start" />
                세무 준비 대시보드 열기
              </Link>
            </Button>
          </div>
        </Panel>
      </section>

      <Panel className="bf-panel-pad">
        <h2 className="bf-panel-title">빠른 이동</h2>
        <p className="bf-helper mt-1">
          자주 쓰는 작업으로 바로 이동합니다.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            description="검토·승인·반려와 엑셀 생성"
            href={expensesHref}
            icon={<ReceiptText className="size-5" />}
            title="지출 검토"
          />
          <QuickAction
            description="VAT 분류·검토 큐·신고 패킷"
            href="/tax"
            icon={<Calculator className="size-5" />}
            title="세무 준비"
          />
          <QuickAction
            description="프로젝트와 Slack 채널 관리"
            href="/projects"
            icon={<FolderKanban className="size-5" />}
            title="프로젝트"
          />
          <QuickAction
            description="엑셀 양식·예산 카테고리"
            href="/settings"
            icon={<Settings2 className="size-5" />}
            title="설정"
          />
        </div>
      </Panel>

      <PriorityStrip aria-label="오늘 처리 순서">
        <PriorityStep status="1순위" title="증빙 없는 지출 확인" tone="missing">
          {summary?.missingEvidenceCount ?? 0}건의 증빙 없음 항목은 보완 요청
          또는 반려를 먼저 결정합니다.
        </PriorityStep>
        <PriorityStep status="2순위" title="검토 필요 항목 정리" tone="review">
          {summary?.needsReviewCount ?? 0}건의 검토 항목을 처리하면 세무 준비도와
          자동 처리 가능률이 함께 올라갑니다.
        </PriorityStep>
        <PriorityStep status="3순위" title="승인 항목 내보내기" tone="approved">
          승인 항목만 모아 제출용 엑셀과 세무 준비 패킷을 생성합니다.
        </PriorityStep>
      </PriorityStrip>
    </section>
  );
}

function ReviewQueueRow({ expense }: { expense: Expense }) {
  return (
    <Link
      className="flex items-center justify-between gap-3 px-1 py-3 outline-none transition-colors hover:bg-[var(--bf-layer-hover)] focus-visible:bg-[var(--bf-layer-hover)] focus-visible:ring-3 focus-visible:ring-ring/50"
      href={projectExpensesHref(expense.projectId)}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <strong className="truncate text-sm font-semibold text-[var(--bf-text-primary)]">
            {expense.merchant}
          </strong>
          {expense.evidenceStatus === "none" ? (
            <StatusBadge tone="missing">
              <FileWarning className="mr-1 size-3" />
              증빙 없음
            </StatusBadge>
          ) : (
            <StatusBadge tone={expenseStatusTone[expense.status]}>
              {expenseStatusLabel[expense.status]}
            </StatusBadge>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-[var(--bf-text-secondary)]">
          {formatDate(expense.date)} · {expense.reviewReason ?? expense.description}
        </p>
      </div>
      <span className="bf-money shrink-0 text-sm font-semibold">
        {formatCurrency(expense.amount)}
      </span>
    </Link>
  );
}

function FigureBox({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "primary";
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] p-3">
      <p className="text-xs font-medium text-[var(--bf-text-muted)]">{label}</p>
      <strong
        className={
          tone === "primary"
            ? "mt-1 block font-mono text-lg font-semibold tabular-nums text-[var(--bf-primary)]"
            : "mt-1 block font-mono text-lg font-semibold tabular-nums text-[var(--bf-text-primary)]"
        }
      >
        {value}
      </strong>
    </div>
  );
}

function QuickAction({
  description,
  href,
  icon,
  title,
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      className="group flex items-start gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] p-4 outline-none transition-colors hover:border-[var(--bf-primary)] hover:bg-[var(--bf-layer-hover)] focus-visible:ring-3 focus-visible:ring-ring/50"
      href={href}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--bf-primary-subtle)] text-[var(--bf-primary-active)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-semibold text-[var(--bf-text-primary)]">
          {title}
          <ArrowRight className="size-3.5 text-[var(--bf-text-muted)] transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="mt-1 block text-xs leading-5 text-[var(--bf-text-secondary)]">
          {description}
        </span>
      </span>
    </Link>
  );
}
