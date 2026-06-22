"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, CircleX, ExternalLink, ImageOff } from "lucide-react";
import { useForm } from "react-hook-form";

import { StatusBadge } from "@/components/budgetflow-ui";
import { ApprovalConfirmDialog } from "@/components/expenses/approval-confirm-dialog";
import { SelectInput, TextArea, TextInput } from "@/components/form-controls";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BudgetCategory, Expense } from "@/lib/domain";
import {
  expenseReviewSchema,
  type ExpenseReviewInput,
  type ExpenseReviewValues,
} from "@/lib/forms/expense-review";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  useApproveExpense,
  useRejectExpense,
} from "@/lib/hooks/use-budgetflow";
import { evidenceStatusLabel, expenseStatusLabel } from "@/lib/status";
import { evidenceStatusTone, expenseStatusTone } from "@/lib/status-tone";

interface ExpenseDetailModalProps {
  expense: Expense | null;
  categories: BudgetCategory[];
  projectId: string;
  onClose: () => void;
}

type ConfirmVariant = "approve" | "reject" | null;

export function ExpenseDetailModal({
  expense,
  categories,
  projectId,
  onClose,
}: ExpenseDetailModalProps) {
  const [confirmVariant, setConfirmVariant] = useState<ConfirmVariant>(null);
  const approveExpense = useApproveExpense(projectId);
  const rejectExpense = useRejectExpense(projectId);

  const form = useForm<ExpenseReviewInput, undefined, ExpenseReviewValues>({
    resolver: zodResolver(expenseReviewSchema),
    values: expense
      ? {
          amount: expense.amount,
          categoryId: expense.categoryId,
          date: expense.date,
          description: expense.description,
          expenseId: expense.id,
        }
      : { amount: 0, categoryId: "", date: "", description: "", expenseId: "" },
  });

  const isMutating = approveExpense.isPending || rejectExpense.isPending;

  const handleApproveConfirm = form.handleSubmit(async (values) => {
    await approveExpense.mutateAsync(values);
    setConfirmVariant(null);
    onClose();
  });

  const handleRejectConfirm = async (reason?: string) => {
    if (!expense) return;
    await rejectExpense.mutateAsync({ expenseId: expense.id, reason });
    setConfirmVariant(null);
    onClose();
  };

  const handleConfirm = async (reason?: string) => {
    if (confirmVariant === "approve") {
      await handleApproveConfirm();
    } else if (confirmVariant === "reject") {
      await handleRejectConfirm(reason);
    }
  };

  return (
    <>
      <Dialog
        open={expense !== null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-2xl">
          {expense && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <StatusBadge tone={expenseStatusTone[expense.status]}>
                    {expenseStatusLabel[expense.status]}
                  </StatusBadge>
                  <span className="text-sm text-[var(--bf-text-muted)]">
                    {formatDate(expense.date)}
                  </span>
                </div>
                <DialogTitle className="mt-1">{expense.merchant}</DialogTitle>
                <p className="text-sm text-[var(--bf-text-secondary)]">
                  {expense.description}
                </p>
              </DialogHeader>

              <div className="space-y-4">
                {expense.reviewReason && (
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--bf-support-warning-border)] bg-[var(--bf-support-warning-bg)] px-3 py-2 text-sm font-medium text-[var(--bf-support-warning-fg)]">
                    <AlertTriangle className="size-4 shrink-0" />
                    {expense.reviewReason}
                  </div>
                )}

                <div className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--bf-text-secondary)]">
                      AI 신뢰도
                    </span>
                    <span className="font-semibold">
                      {Math.round(expense.aiConfidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-[var(--bf-text-secondary)]">
                      금액
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-[var(--bf-text-secondary)]">
                      증빙
                    </span>
                    <StatusBadge
                      tone={evidenceStatusTone[expense.evidenceStatus]}
                    >
                      {evidenceStatusLabel[expense.evidenceStatus]}
                    </StatusBadge>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--bf-text-primary)]">
                      영수증 이미지
                    </span>
                    {expense.receiptImageUrl ? (
                      <a
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--bf-primary)] hover:underline"
                        href={expense.receiptImageUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="size-3.5" />
                        새 탭에서 열기
                      </a>
                    ) : null}
                  </div>
                  {expense.receiptImageUrl ? (
                    <a
                      aria-label={`${expense.merchant} 영수증 원본 보기`}
                      className="block overflow-hidden rounded-md border border-[var(--bf-border-subtle)] bg-white outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
                      href={expense.receiptImageUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={`${expense.merchant} 영수증`}
                        className="mx-auto max-h-72 w-auto object-contain"
                        src={expense.receiptImageUrl}
                      />
                    </a>
                  ) : (
                    <div className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--bf-border-subtle)] text-center">
                      <ImageOff className="size-6 text-[var(--bf-text-muted)]" />
                      <p className="text-xs text-[var(--bf-text-secondary)]">
                        {expense.evidenceStatus === "none"
                          ? "첨부된 영수증이 없습니다."
                          : "영수증 이미지를 불러올 수 없습니다."}
                      </p>
                    </div>
                  )}
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setConfirmVariant("approve");
                  }}
                >
                  <input type="hidden" {...form.register("expenseId")} />

                  <FormField
                    error={form.formState.errors.date?.message}
                    label="날짜"
                  >
                    <TextInput type="date" {...form.register("date")} />
                  </FormField>

                  <FormField
                    error={form.formState.errors.amount?.message}
                    label="금액"
                  >
                    <TextInput
                      inputMode="numeric"
                      type="number"
                      {...form.register("amount")}
                    />
                  </FormField>

                  <FormField
                    error={form.formState.errors.categoryId?.message}
                    label="카테고리"
                  >
                    <SelectInput {...form.register("categoryId")}>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <FormField
                    error={form.formState.errors.description?.message}
                    label="설명"
                  >
                    <TextArea {...form.register("description")} />
                  </FormField>

                  <div className="grid gap-2 pt-2 sm:grid-cols-2">
                    <Button disabled={isMutating} type="submit">
                      <Check className="mr-2 size-4" />
                      승인
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => setConfirmVariant("reject")}
                      type="button"
                      variant="destructive"
                    >
                      <CircleX className="mr-2 size-4" />
                      반려
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ApprovalConfirmDialog
        excludeCount={undefined}
        expenseName={expense?.merchant}
        isPending={isMutating}
        onCancel={() => setConfirmVariant(null)}
        onConfirm={(reason) => void handleConfirm(reason)}
        open={confirmVariant !== null}
        variant={confirmVariant ?? "approve"}
      />
    </>
  );
}
