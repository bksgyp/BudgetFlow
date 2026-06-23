import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import type { StatusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

const statusToneClass: Record<StatusTone, string> = {
  default:
    "border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] text-[var(--bf-text-secondary)]",
  approved:
    "border-[var(--bf-support-success-border)] bg-[var(--bf-support-success-bg)] text-[var(--bf-support-success-fg)]",
  review:
    "border-[var(--bf-support-warning-border)] bg-[var(--bf-support-warning-bg)] text-[var(--bf-support-warning-fg)]",
  missing:
    "border-[var(--bf-support-error-border)] bg-[var(--bf-support-error-bg)] text-[var(--bf-support-error-fg)]",
  processing:
    "border-[var(--bf-support-info-border)] bg-[var(--bf-support-info-bg)] text-[var(--bf-support-info-fg)]",
  rejected:
    "border-[var(--bf-border-strong)] bg-[var(--bf-layer-02)] text-[var(--bf-text-secondary)]",
  exported:
    "border-[var(--bf-status-exported-border)] bg-[var(--bf-status-exported-bg)] text-[var(--bf-status-exported-fg)]",
};

const priorityToneClass: Record<StatusTone, string> = {
  default: "border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)]",
  approved:
    "border-[var(--bf-support-success-border)] bg-[var(--bf-support-success-bg)]",
  review:
    "border-[var(--bf-support-warning-border)] bg-[var(--bf-support-warning-bg)]",
  missing:
    "border-[var(--bf-support-error-border)] bg-[var(--bf-support-error-bg)]",
  processing:
    "border-[var(--bf-support-info-border)] bg-[var(--bf-support-info-bg)]",
  rejected: "border-[var(--bf-border-strong)] bg-[var(--bf-layer-02)]",
  exported:
    "border-[var(--bf-status-exported-border)] bg-[var(--bf-status-exported-bg)]",
};

const progressToneClass: Record<
  Extract<StatusTone, "approved" | "review" | "processing" | "missing">,
  string
> = {
  approved: "bg-[var(--bf-support-success)]",
  review: "bg-[var(--bf-support-warning)]",
  processing: "bg-[var(--bf-support-info)]",
  missing: "bg-[var(--bf-support-error)]",
};

export function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/home"
      className={cn(
        "inline-flex items-center gap-2 text-sm font-semibold text-[var(--bf-text-primary)]",
        className,
      )}
    >
      <span className="grid size-8 place-items-center rounded-md bg-[var(--bf-primary)] text-xs font-semibold text-white">
        BF
      </span>
      <span>
        <b>Budget</b>
        <span className="text-[var(--bf-primary)]">Flow</span>
      </span>
    </Link>
  );
}

export function StatusBadge({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: StatusTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 w-fit items-center whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium leading-tight",
        statusToneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"section">, "children">) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)]",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  actions,
  eyebrow,
  lead,
  title,
}: {
  actions?: ReactNode;
  eyebrow: string;
  lead?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 w-full max-w-xs sm:max-w-3xl">
        <p className="text-xs font-semibold uppercase text-[var(--bf-text-muted)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 break-keep text-[30px] font-semibold leading-[1.27] text-[var(--bf-text-primary)]">
          {title}
        </h1>
        {lead ? (
          <p className="mt-2 break-keep text-sm leading-6 text-[var(--bf-text-secondary)] sm:text-[0.95rem]">
            {lead}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap justify-end gap-2 lg:w-auto lg:shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function PriorityStrip({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"section">, "children">) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] p-3 md:grid-cols-3",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PriorityStep({
  children,
  className,
  status,
  title,
  tone,
}: {
  children: ReactNode;
  className?: string;
  status: string;
  title: string;
  tone: StatusTone;
}) {
  return (
    <article
      className={cn("rounded-lg border p-3", priorityToneClass[tone], className)}
    >
      <StatusBadge tone={tone}>{status}</StatusBadge>
      <strong className="mt-2 block text-sm font-semibold text-[var(--bf-text-primary)]">
        {title}
      </strong>
      <p className="mt-1 text-sm leading-6 text-[var(--bf-text-secondary)]">
        {children}
      </p>
    </article>
  );
}

export function SectionToolbar({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>{children}</div>
      {actions ? (
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  label = "진행률",
  tone = "approved",
  value,
}: {
  label?: string;
  tone?: Extract<StatusTone, "approved" | "review" | "processing" | "missing">;
  value: number;
}) {
  const width = Math.min(100, Math.max(0, value));

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(width)}
      className="h-2 overflow-hidden rounded-full bg-[var(--bf-layer-hover)]"
      role="meter"
    >
      <div
        className={cn("h-full rounded-full", progressToneClass[tone])}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: TValue) => void;
  options: Array<{ count?: number; label: string; value: TValue }>;
  value: TValue;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-2", className)}
      role="group"
    >
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            aria-pressed={isSelected}
            className={cn(
              "h-11 rounded-md border px-3 text-sm font-normal outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/20 sm:h-8",
              isSelected
                ? "border-[var(--bf-primary)] bg-[var(--bf-primary)] text-white"
                : "border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] text-[var(--bf-text-secondary)] hover:bg-[var(--bf-layer-hover)] hover:text-[var(--bf-text-primary)] active:bg-[var(--bf-layer-hover)]",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn(
                  "ml-2 rounded px-1.5 py-0.5 text-xs",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-[var(--bf-layer-hover)] text-[var(--bf-text-secondary)]",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Callout({
  action,
  children,
  className,
  title,
  tone = "default",
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title: string;
  tone?: StatusTone;
}) {
  return (
    <div className={cn("rounded-lg border p-3", priorityToneClass[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="text-sm font-semibold text-[var(--bf-text-primary)]">
            {title}
          </strong>
          <p className="mt-1 text-sm leading-6 text-[var(--bf-text-secondary)]">
            {children}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
