import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-normal whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:bg-[#f5f5f5] disabled:text-[var(--bf-text-muted)] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--bf-primary)] text-white hover:bg-[var(--bf-primary-hover)] active:bg-[var(--bf-primary-active)] [a]:hover:bg-[var(--bf-primary-hover)]",
        outline:
          "border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] text-[var(--bf-text-primary)] hover:border-[var(--bf-primary-hover)] hover:text-[var(--bf-primary-hover)] active:bg-[var(--bf-layer-hover)] aria-expanded:border-[var(--bf-primary-hover)] aria-expanded:text-[var(--bf-primary-hover)] dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-[var(--bf-layer-02)] text-[var(--bf-text-primary)] hover:bg-[var(--bf-layer-hover)] active:bg-[var(--bf-layer-hover)] aria-expanded:bg-[var(--bf-layer-hover)] aria-expanded:text-[var(--bf-text-primary)]",
        ghost:
          "text-[var(--bf-text-secondary)] hover:bg-[var(--bf-layer-hover)] hover:text-[var(--bf-text-primary)] active:bg-[var(--bf-layer-hover)] aria-expanded:bg-[var(--bf-layer-hover)] aria-expanded:text-[var(--bf-text-primary)] dark:hover:bg-muted/50",
        destructive:
          "bg-[var(--bf-support-error-bg)] text-[var(--bf-support-error-fg)] hover:bg-[var(--bf-support-error-border)] active:bg-[var(--bf-support-error-border)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-[var(--bf-primary)] underline-offset-4 hover:underline active:text-[var(--bf-primary-active)]",
      },
      size: {
        default:
          "h-11 gap-1.5 px-4 sm:h-10 sm:px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-11 gap-1 rounded px-3 text-xs sm:h-7 sm:px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 gap-1 rounded-md px-3 text-sm sm:h-9 sm:px-3.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-11 sm:size-10",
        "icon-xs":
          "size-11 rounded sm:size-7 in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-11 rounded-md sm:size-8 in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
