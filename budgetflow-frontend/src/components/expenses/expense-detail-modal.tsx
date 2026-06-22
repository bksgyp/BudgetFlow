"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, CircleX } from "lucide-react";
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--bf-support-warning-bg)] px-3 py-2 text-sm font-medium text-[var(--bf-support-warning-fg)]">
                    <AlertTriangle className="size-4 shrink-0" />
                    {expense.reviewReason}
                  </div>
                )}

                <div className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--bf-text-secondary)]">
                      AI 신뢰도
                    </span>
                    <span className="font-bold">
                      {Math.round(expense.aiConfidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-[var(--bf-text-secondary)]">
                      금액
                    </span>
                    <span className="font-bold tabular-nums">
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

                  <div className="grid grid-cols-2 gap-2 pt-2">
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
