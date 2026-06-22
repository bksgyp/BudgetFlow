import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  BadgeAlert,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileWarning,
  FolderOpen,
  Gauge,
  Hash,
  Home,
  Landmark,
  ListChecks,
  LogIn,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Upload,
  UserRound,
} from "lucide-react";

import { Panel, ProgressBar, StatusBadge } from "@/components/budgetflow-ui";
import { TextArea, TextInput } from "@/components/form-controls";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
import { PreviewExpenseModalTrigger } from "./_expense-modal-trigger";
import {
  mockBudgetCategories,
  mockExpenses,
  mockExportJobs,
  mockProjects,
} from "@/lib/api/mock-data";
import type { EvidenceStatus, Expense, ExpenseStatus, Project } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { evidenceStatusLabel, expenseStatusLabel } from "@/lib/status";
import { evidenceStatusTone, expenseStatusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

export const previewTokens = {
  "--background": "#f5f5f5",
  "--foreground": "#000000e0",
  "--primary": "#1677ff",
  "--ring": "#1677ff",
  "--sidebar": "#001529",
  "--sidebar-foreground": "#ffffffd9",
  "--sidebar-border": "rgb(255 255 255 / 0.12)",
  "--bf-background": "#f5f5f5",
  "--bf-border-strong": "#bfbfbf",
  "--bf-border-subtle": "#d9d9d9",
  "--bf-focus": "#1677ff",
  "--bf-layer-01": "#ffffff",
  "--bf-layer-02": "#fafafa",
  "--bf-layer-hover": "#0000000a",
  "--bf-layer-selected": "#e6f4ff",
  "--bf-primary": "#1677ff",
  "--bf-primary-active": "#0958d9",
  "--bf-primary-hover": "#4096ff",
  "--bf-primary-muted": "#bae0ff",
  "--bf-primary-subtle": "#e6f4ff",
  "--bf-status-exported-bg": "#f6ffed",
  "--bf-status-exported-border": "#b7eb8f",
  "--bf-status-exported-fg": "#389e0d",
  "--bf-support-error": "#ff4d4f",
  "--bf-support-error-bg": "#fff2f0",
  "--bf-support-error-border": "#ffccc7",
  "--bf-support-error-fg": "#cf1322",
  "--bf-support-info": "#1677ff",
  "--bf-support-info-bg": "#e6f4ff",
  "--bf-support-info-border": "#91caff",
  "--bf-support-info-fg": "#0958d9",
  "--bf-support-success": "#52c41a",
  "--bf-support-success-bg": "#f6ffed",
  "--bf-support-success-border": "#b7eb8f",
  "--bf-support-success-fg": "#389e0d",
  "--bf-support-warning": "#faad14",
  "--bf-support-warning-bg": "#fffbe6",
  "--bf-support-warning-border": "#ffe58f",
  "--bf-support-warning-fg": "#d48806",
  "--bf-text-muted": "#00000040",
  "--bf-text-primary": "#000000e0",
  "--bf-text-secondary": "#000000a6",
} as CSSProperties;

export const routeBase = "/design-system-preview";

const navItems = [
  { href: routeBase, icon: Home, label: "홈", count: "" },
  { href: `${routeBase}/login`, icon: LogIn, label: "로그인", count: "" },
  { href: `${routeBase}/projects`, icon: FolderOpen, label: "프로젝트", count: "2" },
  { href: `${routeBase}/expenses`, icon: ReceiptText, label: "지출 검토", count: "6" },
  { href: `${routeBase}/settings`, icon: Settings, label: "설정", count: "" },
];

const iconToneClass = "text-[var(--bf-text-secondary)]";
const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20";

export const primaryProject = mockProjects[0];
export { mockProjects };
export const categories = mockBudgetCategories;
export const expenses = mockExpenses;
export const exportJobs = mockExportJobs;
export const selectedExpense = expenses.find((expense) => expense.id === "exp-005") ?? expenses[0];

export const categoryById = new Map(categories.map((category) => [category.id, category]));

export const totals = {
  approvedAmount: expenses
    .filter((expense) => expense.status === "approved")
    .reduce((sum, expense) => sum + expense.amount, 0),
  approvedCount: expenses.filter((expense) => expense.status === "approved").length,
  missingEvidenceCount: expenses.filter((expense) => expense.evidenceStatus === "none").length,
  needsReviewCount: expenses.filter((expense) => expense.status === "needs_review").length,
  totalAmount: expenses.reduce((sum, expense) => sum + expense.amount, 0),
  totalCount: expenses.length,
};

export const categorySummaries = categories.map((category) => {
  const approvedAmount = expenses
    .filter(
      (expense) =>
        expense.categoryId === category.id && expense.status === "approved",
    )
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    ...category,
    approvedAmount,
    remainingAmount: category.budgetLimit - approvedAmount,
    usageRate: Math.round((approvedAmount / category.budgetLimit) * 100),
  };
});

export function PreviewShell({
  active,
  actions,
  children,
  eyebrow,
  title,
}: {
  active: string;
  actions?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main
      className="min-h-screen bg-[var(--bf-background)] text-[var(--bf-text-primary)]"
      style={previewTokens}
    >
      <div className="grid min-h-screen lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] lg:block">
          <Link
            className={cn(
              "flex h-14 items-center gap-2 border-b border-[var(--sidebar-border)] px-5",
              focusRingClass,
            )}
            href={routeBase}
          >
            <span className="grid size-8 place-items-center rounded-md bg-[var(--bf-primary)] text-xs font-semibold text-white">
              BF
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-white">
                BudgetFlow
              </span>
              <span className="block text-xs text-white/55">Ant redesign</span>
            </span>
          </Link>
          <nav className="space-y-1 p-3" aria-label="Preview navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = active === item.label;

              return (
                <Link
                  className={cn(
                    "flex h-9 items-center justify-between gap-3 rounded-md px-3 text-sm transition-colors",
                    focusRingClass,
                    selected
                      ? "bg-[var(--bf-primary)] text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                  href={item.href}
                  key={item.label}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count ? (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs",
                        selected ? "bg-white/20" : "bg-white/10",
                      )}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)]/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-[var(--bf-text-muted)]">
                  {eyebrow}
                </p>
                <h1 className="mt-1 text-[30px] font-semibold leading-[1.27] tracking-normal text-[var(--bf-text-primary)]">
                  {title}
                </h1>
              </div>
              {actions ? (
                <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                  {actions}
                </div>
              ) : null}
            </div>
          </header>
          <div className="space-y-4 p-4 pb-24 sm:p-6 lg:pb-6">{children}</div>
        </section>
      </div>
      <nav
        aria-label="Preview mobile navigation"
        className="fixed bottom-0 left-0 z-20 flex w-screen border-t border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] lg:hidden"
        style={{ width: "100vw" }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = active === item.label;

          return (
            <Link
              className={cn(
                "flex min-h-14 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 px-1 text-sm transition-colors",
                focusRingClass,
                selected
                  ? "text-[var(--bf-primary)]"
                  : "text-[var(--bf-text-secondary)] hover:bg-[var(--bf-layer-hover)] hover:text-[var(--bf-text-primary)] active:bg-[var(--bf-layer-hover)]",
              )}
              href={item.href}
              key={item.label}
              style={{ flex: "1 1 0", minWidth: 0 }}
            >
              <Icon className="size-4" />
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}

export function TrustStrip() {
  const signals = [
    "Slack 동기화 2분 전",
    `증빙 확인 ${totals.totalCount - totals.missingEvidenceCount}/${totals.totalCount}`,
    "승인 항목만 엑셀 포함",
    "감사 로그 기록됨",
  ];

  return (
    <section className="grid gap-2 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] p-3 text-sm text-[var(--bf-text-secondary)] md:grid-cols-4">
      {signals.map((signal) => (
        <div className="flex items-center gap-2" key={signal}>
          <ShieldCheck className="size-4 shrink-0 text-[var(--bf-text-secondary)]" />
          <span className="truncate">{signal}</span>
        </div>
      ))}
    </section>
  );
}

export function SummaryGrid() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<ClipboardList className="size-4" />}
        label="전체 접수"
        note="Slack 접수 기준"
        status={`${totals.totalCount}건`}
        value={formatCurrency(totals.totalAmount)}
      />
      <SummaryCard
        icon={<Banknote className="size-4" />}
        label="승인 금액"
        note="엑셀 포함 가능"
        status={`${totals.approvedCount}건`}
        tone="success"
        value={formatCurrency(totals.approvedAmount)}
      />
      <SummaryCard
        icon={<BadgeAlert className="size-4" />}
        label="검토 필요"
        note="사유 확인 후 결정"
        status={`${totals.needsReviewCount}건`}
        tone="warning"
        value={`${totals.needsReviewCount}`}
      />
      <SummaryCard
        icon={<FileWarning className="size-4" />}
        label="증빙 없음"
        note="제출 전 보완 필요"
        status={`${totals.missingEvidenceCount}건`}
        tone="danger"
        value={`${totals.missingEvidenceCount}`}
      />
    </section>
  );
}

export function ExpenseTable({ compact = false }: { compact?: boolean }) {
  const visible = compact ? expenses.slice(0, 4) : expenses;

  return (
    <Panel>
      <div className="border-b border-[var(--bf-border-subtle)] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ReceiptText className={`size-4 ${iconToneClass}`} />
              검토 대기열
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--bf-text-secondary)]">
              증빙, 금액, 사유를 같은 행에서 확인하고 승인 또는 반려합니다.
            </p>
          </div>
          <label className="relative min-w-0 sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--bf-text-muted)]" />
            <TextInput className="pl-9" placeholder="사용처, 담당자, 증빙 검색" />
          </label>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead className="bg-[var(--bf-layer-02)] text-left text-xs font-medium text-[var(--bf-text-secondary)]">
            <tr>
              <th className="border-b border-[var(--bf-border-subtle)] px-4 py-3">일자</th>
              <th className="border-b border-[var(--bf-border-subtle)] px-4 py-3">사용처</th>
              <th className="border-b border-[var(--bf-border-subtle)] px-4 py-3">증빙</th>
              <th className="border-b border-[var(--bf-border-subtle)] px-4 py-3 text-right">금액</th>
              <th className="border-b border-[var(--bf-border-subtle)] px-4 py-3">상태</th>
              <th className="border-b border-[var(--bf-border-subtle)] px-4 py-3">검토 사유</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((expense) => (
              <ExpenseRow expense={expense} key={expense.id} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {visible.map((expense) => (
          <ExpenseMobileCard expense={expense} key={expense.id} />
        ))}
      </div>
    </Panel>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const selected = expense.id === selectedExpense.id;
  const category = categoryById.get(expense.categoryId);

  return (
    <tr
      aria-selected={selected}
      className={cn(
        "bg-[var(--bf-layer-01)] transition-colors hover:bg-[var(--bf-layer-hover)] focus-within:bg-[var(--bf-layer-hover)]",
        selected &&
          "bg-[var(--bf-layer-selected)] shadow-[inset_3px_0_0_var(--bf-primary)] hover:bg-[var(--bf-layer-selected)]",
      )}
    >
      <td className="whitespace-nowrap border-b border-[var(--bf-border-subtle)] px-4 py-3 text-[var(--bf-text-secondary)]">
        {formatDate(expense.date)}
      </td>
      <td className="border-b border-[var(--bf-border-subtle)] px-4 py-3">
        <PreviewExpenseModalTrigger
          categoryName={category?.name ?? "미분류"}
          className={cn(
            "inline-block",
            focusRingClass,
          )}
          expense={expense}
        />
        <p className="mt-0.5 text-xs text-[var(--bf-text-secondary)]">
          {expense.payerName} · {category?.name ?? "미분류"}
        </p>
      </td>
      <td className="border-b border-[var(--bf-border-subtle)] px-4 py-3">
        <EvidenceInline status={expense.evidenceStatus} />
      </td>
      <td className="border-b border-[var(--bf-border-subtle)] px-4 py-3 text-right font-mono font-semibold tabular-nums">
        {formatCurrency(expense.amount)}
      </td>
      <td className="border-b border-[var(--bf-border-subtle)] px-4 py-3">
        <StatusBadge tone={expenseStatusTone[expense.status]}>
          <StatusDot tone={expense.status} />
          {expenseStatusLabel[expense.status]}
        </StatusBadge>
      </td>
      <td className="max-w-xs border-b border-[var(--bf-border-subtle)] px-4 py-3 text-[var(--bf-text-secondary)]">
        {expense.reviewReason ?? expense.description}
      </td>
    </tr>
  );
}

function ExpenseMobileCard({ expense }: { expense: Expense }) {
  const category = categoryById.get(expense.categoryId);

  return (
    <article className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PreviewExpenseModalTrigger
            categoryName={category?.name ?? "미분류"}
            className={cn("block max-w-full truncate", focusRingClass)}
            expense={expense}
          />
          <p className="mt-1 text-sm text-[var(--bf-text-secondary)]">
            {expense.payerName} · {category?.name ?? "미분류"}
          </p>
        </div>
        <StatusBadge tone={expenseStatusTone[expense.status]}>
          {expenseStatusLabel[expense.status]}
        </StatusBadge>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--bf-text-secondary)]">
        {expense.reviewReason ?? expense.description}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--bf-border-subtle)] pt-3">
        <EvidenceInline status={expense.evidenceStatus} />
        <span className="font-mono font-semibold tabular-nums">
          {formatCurrency(expense.amount)}
        </span>
      </div>
    </article>
  );
}

function EvidenceInline({ status }: { status: EvidenceStatus }) {
  const tone = evidenceStatusTone[status];

  return (
    <p className="flex items-center gap-1.5 text-[var(--bf-text-primary)]">
      <ReceiptText
        className={cn(
          "size-4 shrink-0",
          tone === "approved" && "text-[var(--bf-support-success)]",
          tone === "review" && "text-[var(--bf-support-warning)]",
          tone === "missing" && "text-[var(--bf-support-error)]",
          tone === "processing" && "text-[var(--bf-support-info)]",
        )}
      />
      <span>{evidenceStatusLabel[status]}</span>
    </p>
  );
}

function StatusDot({ tone }: { tone: ExpenseStatus }) {
  return (
    <span
      className={cn(
        "mr-1.5 size-1.5 rounded-full",
        tone === "approved" && "bg-[var(--bf-support-success)]",
        tone === "needs_review" && "bg-[var(--bf-support-warning)]",
        tone === "rejected" && "bg-[var(--bf-support-error)]",
        tone === "processing" && "bg-[var(--bf-support-info)]",
        tone === "exported" && "bg-[var(--bf-support-success)]",
        tone === "created" && "bg-[var(--bf-text-muted)]",
      )}
    />
  );
}

export function DetailPanel() {
  const category = categoryById.get(selectedExpense.categoryId);

  return (
    <aside className="space-y-4">
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <StatusBadge tone="review">검토 필요</StatusBadge>
            <h2 className="mt-3 flex items-center gap-2 text-base font-semibold">
              <ReceiptText className={`size-4 ${iconToneClass}`} />
              {selectedExpense.id} 상세 검토
            </h2>
          </div>
          <StatusBadge tone={evidenceStatusTone[selectedExpense.evidenceStatus]}>
            {evidenceStatusLabel[selectedExpense.evidenceStatus]}
          </StatusBadge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm">
          <InfoRow icon={<Landmark className="size-4" />} label="거래처" value={selectedExpense.merchant} />
          <InfoRow icon={<UserRound className="size-4" />} label="담당자" value={selectedExpense.payerName} />
          <InfoRow icon={<Tag className="size-4" />} label="분류" value={category?.name ?? "미분류"} />
          <InfoRow icon={<Banknote className="size-4" />} label="금액" value={formatCurrency(selectedExpense.amount)} />
          <InfoRow icon={<Hash className="size-4" />} label="Slack 원본" value={`#${primaryProject.slackChannelName}`} />
        </dl>
        <div className="mt-4 rounded-lg border border-[var(--bf-support-warning-border)] bg-[var(--bf-support-warning-bg)] p-3">
          <div className="flex gap-2">
            <BadgeAlert className="mt-0.5 size-4 text-[var(--bf-support-warning-fg)]" />
            <p className="text-sm leading-6 text-[var(--bf-text-primary)]">
              {selectedExpense.reviewReason ?? "검토 사유를 확인하세요."} 승인 전 증빙 보완 여부를 결정합니다.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          <Button>
            <CheckCircle2 data-icon="inline-start" />
            승인
          </Button>
          <Button variant="destructive">
            <FileWarning data-icon="inline-start" />
            반려
          </Button>
        </div>
      </Panel>

      <Panel className="p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ListChecks className={`size-4 ${iconToneClass}`} />
          제출 가능 상태
        </h2>
        <div className="mt-4 space-y-3">
          <ReadinessRow
            icon={<FileCheck2 className="size-4" />}
            label="승인 완료"
            tone="approved"
            value={`${totals.approvedCount}건`}
          />
          <ReadinessRow
            icon={<BadgeAlert className="size-4" />}
            label="검토 제외"
            tone="review"
            value={`${totals.needsReviewCount}건`}
          />
          <ReadinessRow
            icon={<FileSpreadsheet className="size-4" />}
            label="최근 파일"
            tone="exported"
            value={`${exportJobs[0]?.includedExpenseCount ?? 0}건 포함`}
          />
        </div>
      </Panel>
    </aside>
  );
}

export function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--bf-border-subtle)] pb-2 last:border-b-0 last:pb-0">
      <dt className="flex items-center gap-2 text-[var(--bf-text-secondary)]">
        {icon ? <span className="text-[var(--bf-text-secondary)]">{icon}</span> : null}
        {label}
      </dt>
      <dd className="text-right font-medium text-[var(--bf-text-primary)]">
        {value}
      </dd>
    </div>
  );
}

function ReadinessRow({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: "approved" | "review" | "exported";
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-[var(--bf-text-secondary)]">
        <span
          className={cn(
            tone === "approved" && "text-[var(--bf-support-success)]",
            tone === "review" && "text-[var(--bf-support-warning)]",
            tone === "exported" && "text-[var(--bf-support-success)]",
          )}
        >
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <StatusBadge tone={tone}>{value}</StatusBadge>
    </div>
  );
}

export function ExportReadinessPanel() {
  return (
    <Panel className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Gauge className={`size-4 ${iconToneClass}`} />
            엑셀 생성 준비
          </h2>
          <p className="mt-1 text-sm text-[var(--bf-text-secondary)]">
            승인 완료된 항목만 제출 파일에 포함됩니다.
          </p>
        </div>
        <div className="w-full max-w-sm space-y-2">
          <div className="flex justify-between text-xs text-[var(--bf-text-secondary)]">
            <span>검토 완료율</span>
            <span>67%</span>
          </div>
          <ProgressBar value={67} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ReadinessCard
          amount={formatCurrency(totals.approvedAmount)}
          icon={<FileCheck2 className="size-4" />}
          label="포함"
          tone="approved"
          value={`${totals.approvedCount}건`}
        />
        <ReadinessCard
          amount={formatCurrency(totals.totalAmount - totals.approvedAmount)}
          icon={<BadgeAlert className="size-4" />}
          label="검토 제외"
          tone="review"
          value={`${totals.needsReviewCount}건`}
        />
        <ReadinessCard
          amount="만료 전 다운로드 가능"
          icon={<Download className="size-4" />}
          label="최근 생성"
          tone="exported"
          value="1개"
        />
      </div>
    </Panel>
  );
}

function ReadinessCard({
  amount,
  icon,
  label,
  tone,
  value,
}: {
  amount: string;
  icon: ReactNode;
  label: string;
  tone: "approved" | "review" | "exported";
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] p-3">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge tone={tone}>{label}</StatusBadge>
        <span className="text-[var(--bf-text-secondary)]">{icon}</span>
      </div>
      <p className="mt-3 text-lg font-semibold">{value}</p>
      <p className="font-mono text-sm tabular-nums text-[var(--bf-text-secondary)]">
        {amount}
      </p>
    </div>
  );
}

export function ProjectTable() {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FolderOpen className={`size-4 ${iconToneClass}`} />
            프로젝트 목록
          </h2>
          <p className="mt-1 text-sm text-[var(--bf-text-secondary)]">
            Slack 채널, 예산, 양식 매핑 상태를 같은 행에서 확인합니다.
          </p>
        </div>
        <Button asChild>
          <Link href={`${routeBase}/expenses`}>
            검토 시작
          </Link>
        </Button>
      </div>
      <div className="mt-4 divide-y divide-[var(--bf-border-subtle)]">
        {mockProjects.map((project) => (
          <ProjectRow project={project} key={project.id} />
        ))}
      </div>
    </Panel>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const usage =
    project.status === "closed" ? 100 : project.totalBudget > 1_000_000 ? 68 : 42;

  return (
    <Link
      className={cn(
        "grid gap-3 rounded-md px-1 py-4 transition-colors hover:bg-[var(--bf-layer-hover)] md:grid-cols-[minmax(0,1fr)_180px_120px_96px] md:items-center",
        focusRingClass,
      )}
      href={`${routeBase}/expenses/${project.id}`}
    >
      <div className="min-w-0">
        <strong className="block truncate text-sm font-semibold">{project.name}</strong>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--bf-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <Hash className="size-3.5" />
            #{project.slackChannelName}
          </span>
          <span>{formatDate(project.createdAt)} 생성</span>
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-2 text-xs">
          <span className="text-[var(--bf-text-secondary)]">예산</span>
          <span className="font-mono tabular-nums">
            {formatCurrency(project.totalBudget)}
          </span>
        </div>
        <ProgressBar tone={usage > 75 ? "review" : "processing"} value={usage} />
      </div>
      <StatusBadge tone={project.templateMappingStatus === "confirmed" ? "approved" : "processing"}>
        <FileSpreadsheet className="mr-1 size-3" />
        {project.templateMappingStatus === "confirmed" ? "양식 확정" : "매핑 추천"}
      </StatusBadge>
      <StatusBadge tone={project.status === "active" ? "processing" : "rejected"}>
        {project.status === "active" ? "진행 중" : "마감"}
      </StatusBadge>
    </Link>
  );
}

export function SettingsFormPreview() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Panel className="p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Upload className={`size-4 ${iconToneClass}`} />
            엑셀 양식 업로드
          </h2>
          <p className="mt-1 text-sm text-[var(--bf-text-secondary)]">
            양식 파일과 컬럼 매핑이 확정되어야 제출용 엑셀 생성이 명확해집니다.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <TextInput defaultValue="법인운영비_지출내역서.xlsx" />
            <Button>
              <Upload data-icon="inline-start" />
              매핑 추천
            </Button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["날짜", "지출일자", "94%", "approved"],
              ["사용처", "거래처명", "90%", "approved"],
              ["카테고리", "예산 항목", "88%", "processing"],
              ["증빙 링크", "첨부자료", "76%", "review"],
            ].map(([source, target, confidence, tone]) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-3 py-2 text-sm"
                key={source}
              >
                <span>
                  <span className="block">{source} → {target}</span>
                  <span className="mt-1 block text-xs text-[var(--bf-text-secondary)]">
                    추천 신뢰도 {confidence}
                  </span>
                </span>
                <StatusBadge tone={tone as "approved" | "processing" | "review"}>
                  {tone === "approved"
                    ? "확정"
                    : tone === "review"
                      ? "확인 필요"
                      : "추천됨"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Tag className={`size-4 ${iconToneClass}`} />
            예산 카테고리
          </h2>
          <div className="mt-4 divide-y divide-[var(--bf-border-subtle)]">
            {categorySummaries.map((category) => (
              <div className="py-4" key={category.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong className="text-sm">{category.name}</strong>
                    <p className="mt-1 text-sm text-[var(--bf-text-secondary)]">
                      {category.keywords.join(", ")}
                    </p>
                  </div>
                  <StatusBadge tone={category.remainingAmount < 0 ? "missing" : "approved"}>
                    {category.remainingAmount < 0 ? "초과" : "정상"}
                  </StatusBadge>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs text-[var(--bf-text-secondary)]">
                    <span>{formatCurrency(category.approvedAmount)}</span>
                    <span>{formatCurrency(category.budgetLimit)}</span>
                  </div>
                  <ProgressBar
                    tone={category.usageRate > 80 ? "review" : "approved"}
                    value={category.usageRate}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <aside className="space-y-4">
        <Panel className="p-4">
          <h2 className="text-base font-semibold">검토 필요 정책</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {["AI 신뢰도 낮음", "예산 초과 가능", "영수증 없음", "필수 필드 누락"].map(
              (policy) => (
                <StatusBadge key={policy} tone={policy === "영수증 없음" ? "missing" : "review"}>
                  {policy}
                </StatusBadge>
              ),
            )}
          </div>
        </Panel>
        <Panel className="p-4">
          <h2 className="text-base font-semibold">카테고리 추가</h2>
          <div className="mt-4 space-y-3">
            <TextInput placeholder="카테고리명" />
            <TextInput placeholder="예산 한도" />
            <TextArea placeholder="간식, 커피, 음료" />
            <Button className="w-full">추가</Button>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
