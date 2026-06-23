"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

/**
 * 디자인 시스템(Ant 계열) 준수 Select.
 * - 트리거: 흰 배경, 1px #D9D9D9 border, 6px radius, 14px, Daybreak Blue 포커스 링 (Inputs 스펙)
 * - 모바일 44px / 데스크톱 32px (밀도 + 터치 타깃)
 */
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] px-3 text-sm text-[var(--bf-text-primary)] outline-none transition-colors sm:h-8",
      "hover:border-[var(--bf-border-strong)]",
      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20",
      "data-[placeholder]:text-[var(--bf-text-muted)]",
      "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
      "disabled:cursor-not-allowed disabled:bg-[#f5f5f5] disabled:text-[var(--bf-text-muted)]",
      "[&>span]:line-clamp-1 [&>span]:text-left",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-[var(--bf-text-muted)]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

/**
 * 옵션 팝오버: 흰 배경, 8px radius, §6 플로팅 섀도우, §15 calm 모션(200ms).
 */
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={4}
      className={cn(
        "relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] text-sm text-[var(--bf-text-primary)]",
        "shadow-[0_6px_16px_rgba(0,0,0,0.08),0_9px_28px_rgba(0,0,0,0.05)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        position === "popper" &&
          "min-w-[var(--radix-select-trigger-width)] data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "max-h-72 overflow-y-auto p-1",
          position === "popper" && "w-full",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

/**
 * 옵션 항목: hover=#0000000A, 선택=#E6F4FF 채움 + Daybreak Blue 텍스트 + 체크.
 */
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-8 text-sm outline-none transition-colors sm:py-1.5",
      "data-[highlighted]:bg-[var(--bf-layer-hover)]",
      "data-[state=checked]:bg-[var(--bf-primary-subtle)] data-[state=checked]:font-medium data-[state=checked]:text-[var(--bf-primary)]",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 text-[var(--bf-primary)]" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
};
