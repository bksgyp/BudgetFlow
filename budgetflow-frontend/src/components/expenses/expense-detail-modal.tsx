"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, CircleX, ExternalLink, ImageOff, Trash2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";

import { StatusBadge } from "@/components/budgetflow-ui";
import { ApprovalConfirmDialog } from "@/components/expenses/approval-confirm-dialog";
import { TextArea, TextInput } from "@/components/form-controls";
import { FormField } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useDeleteExpense,
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
  const deleteExpense = useDeleteExpense(projectId);

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

  const isMutating =
    approveExpense.isPending ||
    rejectExpense.isPending ||
    deleteExpense.isPending;

  const handleDelete = async () => {
    if (!expense) return;
    await deleteExpense.mutateAsync(expense.id);
    onClose();
  };

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
                    <Controller
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || undefined}
                        >
                          <SelectTrigger
                            aria-invalid={!!form.formState.errors.categoryId}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          >
                            <SelectValue placeholder="카테고리 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
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

                <div className="flex flex-col gap-2 border-t border-[var(--bf-border-subtle)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-[var(--bf-text-muted)]">
                    잘못 등록된 지출은 삭제할 수 있습니다. 삭제하면 되돌릴 수
                    없습니다.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="text-[var(--bf-support-error-fg)] hover:bg-[var(--bf-support-error-bg)] hover:text-[var(--bf-support-error-fg)]"
                        disabled={isMutating}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="mr-1.5 size-4" />
                        지출 삭제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>이 지출을 삭제할까요?</AlertDialogTitle>
                        <AlertDialogDescription>
                          <span className="font-medium text-[var(--bf-text-primary)]">
                            {expense.merchant}
                          </span>{" "}
                          · {formatCurrency(expense.amount)} 지출이 영구
                          삭제됩니다. 연결된 영수증 증빙도 함께 삭제되며 되돌릴
                          수 없습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isMutating}>
                          취소
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className={buttonVariants({ variant: "destructive" })}
                          disabled={isMutating}
                          onClick={(event) => {
                            event.preventDefault();
                            void handleDelete();
                          }}
                        >
                          <Trash2 className="mr-1.5 size-4" />
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
