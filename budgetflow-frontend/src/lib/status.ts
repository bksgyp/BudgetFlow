import type { EvidenceStatus, ExpenseStatus } from "@/lib/domain";

export const expenseStatusLabel: Record<ExpenseStatus, string> = {
  created: "생성됨",
  processing: "분석 중",
  needs_review: "검토 필요",
  approved: "승인 완료",
  rejected: "반려",
  exported: "엑셀 반영",
};

export const evidenceStatusLabel: Record<EvidenceStatus, string> = {
  none: "없음",
  uploaded: "업로드",
  ocr_completed: "OCR 완료",
  ocr_failed: "OCR 실패",
  verified: "확인 완료",
};

export const expenseStatusFilterOptions: Array<{
  value: ExpenseStatus | "all";
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "processing", label: "분석 중" },
  { value: "needs_review", label: "검토 필요" },
  { value: "approved", label: "승인 완료" },
  { value: "rejected", label: "반려" },
];
