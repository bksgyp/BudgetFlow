import type { ComponentProps } from "react";

export const formControlClass =
  "w-full rounded-md border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] px-3 text-sm text-[var(--bf-text-primary)] outline-none transition-colors placeholder:text-[var(--bf-text-muted)] hover:border-[var(--bf-border-strong)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:bg-[#f5f5f5] disabled:text-[var(--bf-text-muted)]";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`${formControlClass} h-11 sm:h-8 ${className ?? ""}`}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`${formControlClass} min-h-28 resize-none py-2.5 ${className ?? ""}`}
      {...props}
    />
  );
}

export function SelectInput({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`${formControlClass} h-11 sm:h-8 ${className ?? ""}`}
      {...props}
    />
  );
}
