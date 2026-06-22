import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] px-3 py-2 text-sm leading-6 text-[var(--bf-text-primary)] outline-none transition-colors placeholder:text-[var(--bf-text-muted)] hover:border-[var(--bf-border-strong)] focus-visible:border-[var(--bf-focus)] focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20 disabled:cursor-not-allowed disabled:bg-[#f5f5f5] disabled:text-[var(--bf-text-muted)]",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
