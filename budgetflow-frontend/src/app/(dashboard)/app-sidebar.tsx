"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, LogOut, Receipt, Settings2 } from "lucide-react";

import { useSelectedProject } from "@/lib/hooks/use-selected-project";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/projects", label: "프로젝트", icon: Folder },
  { href: "/expenses", label: "지출", icon: Receipt, badge: 0 },
  { href: "/settings", label: "설정", icon: Settings2 },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { projects, selectedProjectId, setSelectedProjectId } =
    useSelectedProject();

  return (
    <aside className="flex h-screen w-[232px] shrink-0 flex-col gap-[18px] bg-[#0C3832] px-[14px] py-5 sticky top-0">
      {/* 브랜드 */}
      <Link href="/projects" className="flex items-center gap-[9px] px-2 pt-1">
        <Image
          src="/logo-mark.svg"
          alt="BudgetFlow"
          width={28}
          height={28}
          className="rounded-[7px]"
        />
        <span className="font-bold text-[18px]">
          <b className="text-white">Budget</b>
          <span className="text-[#79C5B6]">Flow</span>
        </span>
      </Link>

      {/* 프로젝트 선택 */}
      {projects.length > 0 && (
        <select
          aria-label="프로젝트 선택"
          className="w-full rounded-lg bg-white/[0.08] px-3 py-[9px] text-[13px] font-semibold text-white outline-none"
          onChange={(event) => setSelectedProjectId(event.target.value)}
          value={selectedProjectId ?? ""}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      )}

      {/* 내비게이션 */}
      <nav className="flex flex-col gap-[3px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badge = "badge" in item ? item.badge : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-[11px] rounded-lg px-3 py-[10px] text-[14px] font-semibold transition-all duration-[120ms]",
                isActive
                  ? "bg-[#126B5D] text-white"
                  : "text-[#D6EEE9] hover:bg-white/[0.08] hover:text-white",
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                    isActive
                      ? "bg-white text-[#0F574C]"
                      : "bg-[#D98A1F] text-white",
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 하단 사용자 */}
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center gap-[9px] rounded-lg bg-white/[0.05] p-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#D6EEE9] text-[13px] font-bold text-[#0F574C]">
            운
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">운영자</div>
            <div className="mt-[1px] text-[11px] text-[#79C5B6]">
              워크스페이스 관리자
            </div>
          </div>
        </div>
        <Link
          href="/login"
          className="flex w-full items-center gap-[9px] rounded-lg px-3 py-[9px] text-[13px] font-medium text-[#ADDDD3] transition-all duration-[120ms] hover:bg-white/[0.08] hover:text-white"
        >
          <LogOut className="size-4 shrink-0" />
          로그아웃
        </Link>
      </div>
    </aside>
  );
}
