"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, FolderKanban, LayoutDashboard, ReceiptText, Settings } from "lucide-react";

import { useSelectedProject } from "@/lib/hooks/use-selected-project";
import { projectExpensesHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/home", label: "홈", icon: LayoutDashboard },
  { href: "/projects", label: "프로젝트", icon: FolderKanban },
  { href: "/expenses", label: "지출", icon: ReceiptText },
  { href: "/tax", label: "세무", icon: Calculator },
  { href: "/settings", label: "설정", icon: Settings },
];

type DashboardNavProps = {
  placement?: "desktop" | "mobile";
};

export function DashboardNav({ placement = "desktop" }: DashboardNavProps) {
  const pathname = usePathname();
  const { selectedProjectId } = useSelectedProject();
  const isMobile = placement === "mobile";

  return (
    <nav
      aria-label={isMobile ? "모바일 주요 화면" : "주요 화면"}
      className={cn(
        isMobile
          ? "grid grid-cols-5 gap-1"
          : "hidden items-center gap-1 md:flex",
      )}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const href =
          item.href === "/expenses" && selectedProjectId
            ? projectExpensesHref(selectedProjectId)
            : item.href;
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              isMobile
                ? "min-h-14 flex-col px-2 text-[0.72rem]"
                : "h-10 px-3 text-sm",
              isActive
                ? "bg-[var(--bf-primary-subtle)] text-[var(--bf-status-exported-fg)] shadow-sm"
                : "text-[var(--bf-text-secondary)] hover:bg-[var(--bf-layer-hover)] hover:text-[var(--bf-text-primary)]",
            )}
            href={href}
            key={item.href}
          >
            <Icon className={cn(isMobile ? "size-[1.125rem]" : "size-4")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
