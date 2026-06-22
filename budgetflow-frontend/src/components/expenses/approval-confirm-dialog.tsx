"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

type ApprovalConfirmVariant = "approve" | "reject" | "close" | "export";

interface ApprovalConfirmDialogProps {
  open: boolean;
  variant: ApprovalConfirmVariant;
  /** approve/reject: 지출명. close/export: undefined */
  expenseName?: string;
  /** export 전용: 제외될 검토 필요 건수 */
  excludeCount?: number;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}

const variantConfig: Record<
  ApprovalConfirmVariant,
  {
    title: string;
    description: (ctx: { name?: string; count?: number }) => string;
    confirmLabel: string;
    confirmClass: string;
  }
> = {
  approve: {
    title: "지출을 승인할까요?",
    description: ({ name }) =>
      `"${name}"을 승인하고 엑셀 생성 대상에 포함합니다.`,
    confirmLabel: "승인",
    confirmClass:
      "bg-[var(--bf-support-success)] text-white hover:bg-[var(--bf-support-success-fg)] active:bg-[var(--bf-support-success-fg)]",
  },
  reject: {
    title: "지출을 반려할까요?",
    description: ({ name }) =>
      `"${name}"을 엑셀 생성 대상에서 제외합니다. 필요하면 반려 사유를 남기세요.`,
    confirmLabel: "반려",
    confirmClass:
      "bg-[var(--bf-support-error)] text-white hover:bg-[var(--bf-support-error-fg)] active:bg-[var(--bf-support-error-fg)]",
  },
  close: {
    title: "정산을 마감할까요?",
    description: () =>
      "마감 후에는 Slack 입력이 차단된 상태로 표시됩니다. 늦은 증빙이 있다면 먼저 검토하세요.",
    confirmLabel: "정산 마감",
    confirmClass: "",
  },
  export: {
    title: "검토 필요 항목을 제외하고 생성할까요?",
    description: ({ count }) =>
      `검토 필요 항목 ${count ?? 0}건은 제외됩니다. 승인 완료 항목만 포함해 지출내역서를 생성합니다.`,
    confirmLabel: "엑셀 생성",
    confirmClass: "",
  },
};

export function ApprovalConfirmDialog({
  open,
  variant,
  expenseName,
  excludeCount,
  isPending,
  onCancel,
  onConfirm,
}: ApprovalConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const config = variantConfig[variant];

  const handleConfirm = () => {
    onConfirm(variant === "reject" ? reason : undefined);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onCancel();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {config.description({ name: expenseName, count: excludeCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {variant === "reject" && (
          <div className="mt-2">
            <Textarea
              autoFocus
              className="resize-none"
              onChange={(e) => setReason(e.target.value)}
              placeholder="반려 사유를 입력하세요 (선택)"
              rows={3}
              value={reason}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={onCancel}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            className={config.confirmClass}
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {config.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
