import type { ReactNode } from "react";

type SummaryTone = "default" | "success" | "warning" | "danger";

type SummaryCardProps = {
  icon?: ReactNode;
  label: string;
  note?: string;
  status?: string;
  value: string;
  tone?: SummaryTone;
};

const toneClass: Record<SummaryTone, string> = {
  default: "border-[var(--bf-border-subtle)]",
  success: "border-[var(--bf-border-subtle)] border-l-[var(--bf-support-success)]",
  warning: "border-[var(--bf-border-subtle)] border-l-[var(--bf-support-warning)]",
  danger: "border-[var(--bf-border-subtle)] border-l-[var(--bf-support-error)]",
};

export function SummaryCard({
  icon,
  label,
  note,
  status,
  value,
  tone = "default",
}: SummaryCardProps) {
  return (
    <div
      className={`rounded-lg border border-l-2 bg-[var(--bf-layer-01)] p-4 ${toneClass[tone]}`}
    >
      <div className="flex min-h-6 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-md border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] text-[var(--bf-text-secondary)]">
              {icon}
            </span>
          ) : null}
          <p className="text-sm font-medium text-[var(--bf-text-secondary)]">
            {label}
          </p>
        </div>
        {status ? (
          <span className="rounded bg-[var(--bf-layer-01)] px-2 py-0.5 text-xs font-medium text-[var(--bf-text-secondary)] ring-1 ring-[var(--bf-border-subtle)]">
            {status}
          </span>
        ) : null}
      </div>
      <p className="mt-2 break-keep font-mono text-xl font-semibold tabular-nums text-[var(--bf-text-primary)]">
        {value}
      </p>
      {note ? (
        <p className="mt-1 text-xs leading-5 text-[var(--bf-text-muted)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
