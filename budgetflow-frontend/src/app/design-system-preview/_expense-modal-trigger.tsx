"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, FileWarning } from "lucide-react";

import { StatusBadge } from "@/components/budgetflow-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Expense } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { evidenceStatusLabel, expenseStatusLabel } from "@/lib/status";
import { expenseStatusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

const previewDialogTokens = {
  "--bf-border-strong": "#bfbfbf",
  "--bf-border-subtle": "#d9d9d9",
  "--bf-focus": "#1677ff",
  "--bf-layer-01": "#ffffff",
  "--bf-layer-02": "#fafafa",
  "--bf-primary-active": "#0958d9",
  "--bf-primary-hover": "#4096ff",
  "--bf-support-error": "#ff4d4f",
  "--bf-support-error-bg": "#fff2f0",
  "--bf-support-error-border": "#ffccc7",
  "--bf-support-error-fg": "#cf1322",
  "--bf-support-success": "#52c41a",
  "--bf-support-success-fg": "#389e0d",
  "--bf-support-warning-bg": "#fffbe6",
  "--bf-support-warning-border": "#ffe58f",
  "--bf-support-warning-fg": "#d48806",
  "--bf-text-muted": "#00000040",
  "--bf-text-primary": "#000000e0",
  "--bf-text-secondary": "#000000a6",
} as CSSProperties;

interface PreviewExpenseModalTriggerProps {
  categoryName: string;
  className?: string;
  expense: Expense;
}

export function PreviewExpenseModalTrigger({
  categoryName,
  className,
  expense,
}: PreviewExpenseModalTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={`${expense.merchant} 지출 상세 열기`}
        className={cn(
          "rounded-md text-left font-medium text-[var(--bf-text-primary)] transition-colors hover:text-[var(--bf-primary-hover)] active:text-[var(--bf-primary-active)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20",
          className,
        )}
        onClick={() => setOpen(true)}
        type="button"
      >
        {expense.merchant}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" style={previewDialogTokens}>
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={expenseStatusTone[expense.status]}>
                {expenseStatusLabel[expense.status]}
              </StatusBadge>
              <span className="text-sm text-[var(--bf-text-muted)]">
                {formatDate(expense.date)}
              </span>
            </div>
            <DialogTitle className="mt-1">{expense.merchant}</DialogTitle>
            <p className="text-sm leading-6 text-[var(--bf-text-secondary)]">
              {expense.description}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {expense.reviewReason ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--bf-support-warning-border)] bg-[var(--bf-support-warning-bg)] px-3 py-2 text-sm font-medium text-[var(--bf-support-warning-fg)]">
                <AlertTriangle className="size-4 shrink-0" />
                {expense.reviewReason}
              </div>
            ) : null}

            <dl className="grid gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] p-4 text-sm sm:grid-cols-2">
              <InfoRow label="카테고리" value={categoryName} />
              <InfoRow label="결제자" value={expense.payerName} />
              <InfoRow label="금액" value={formatCurrency(expense.amount)} />
              <InfoRow
                label="AI 신뢰도"
                value={`${Math.round(expense.aiConfidence * 100)}%`}
              />
              <InfoRow
                label="증빙"
                value={evidenceStatusLabel[expense.evidenceStatus]}
              />
              <InfoRow label="상태" value={expenseStatusLabel[expense.status]} />
            </dl>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={() => setOpen(false)} type="button">
                <CheckCircle2 data-icon="inline-start" />
                승인
              </Button>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="destructive"
              >
                <FileWarning data-icon="inline-start" />
                반려
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--bf-text-secondary)]">{label}</dt>
      <dd className="text-right font-semibold text-[var(--bf-text-primary)]">
        {value}
      </dd>
    </div>
  );
}
