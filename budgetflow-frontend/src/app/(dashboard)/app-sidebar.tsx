"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calculator,
  Check,
  ChevronDown,
  Folder,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings2,
} from "lucide-react";

import type { Project } from "@/lib/domain";
import { useSelectedProject } from "@/lib/hooks/use-selected-project";
import { projectExpensesHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/home", label: "홈", icon: LayoutDashboard },
  { href: "/projects", label: "프로젝트", icon: Folder },
  { href: "/expenses", label: "지출", icon: Receipt, badge: 0 },
  { href: "/tax", label: "세무", icon: Calculator },
  { href: "/settings", label: "설정", icon: Settings2 },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, selectedProjectId, setSelectedProjectId } =
    useSelectedProject();
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    router.push(projectExpensesHref(projectId));
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col gap-[18px] bg-[#001529] px-[14px] py-5">
      {/* 브랜드 */}
      <Link href="/home" className="flex items-center gap-[9px] px-2 pt-1">
        <Image
          src="/logo-mark.svg"
          alt="BudgetFlow"
          width={28}
          height={28}
          className="rounded-[7px]"
        />
        <span className="font-bold text-[18px]">
          <b className="text-white">Budget</b>
          <span className="text-[#69B1FF]">Flow</span>
        </span>
      </Link>

      {/* 프로젝트 선택 */}
      {projects.length > 0 && (
        <ProjectSwitcher
          onProjectChange={handleProjectChange}
          projects={projects}
          selectedProject={selectedProject}
          selectedProjectId={selectedProjectId}
        />
      )}

      {/* 내비게이션 */}
      <nav className="flex flex-col gap-[3px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const href =
            item.href === "/expenses" && selectedProjectId
              ? projectExpensesHref(selectedProjectId)
              : item.href;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badge = "badge" in item ? item.badge : 0;

          return (
            <Link
              key={item.href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-[11px] rounded-lg px-3 py-[10px] text-[14px] font-semibold transition-all duration-[120ms]",
                isActive
                  ? "bg-[#1677FF] text-white"
                  : "text-white/70 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                    isActive
                      ? "bg-white text-[#0958D9]"
                      : "bg-[#FAAD14] text-[#000000E0]",
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
          <span className="grid size-8 shrink-0 place-items-center rounded bg-[#E6F4FF] text-[13px] font-semibold text-[#0958D9]">
            운
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">운영자</div>
            <div className="mt-[1px] text-[11px] text-[#69B1FF]">
              워크스페이스 관리자
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem("budgetflow.session");
            router.push("/login");
          }}
          className="flex w-full items-center gap-[9px] rounded-md px-3 py-[9px] text-[13px] font-medium text-white/65 transition-all duration-[120ms] hover:bg-white/[0.08] hover:text-white"
        >
          <LogOut className="size-4 shrink-0" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}

function ProjectSwitcher({
  onProjectChange,
  projects,
  selectedProject,
  selectedProjectId,
}: {
  onProjectChange: (projectId: string) => void;
  projects: Project[];
  selectedProject: Project | undefined;
  selectedProjectId: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const chooseProject = (projectId: string) => {
    onProjectChange(projectId);
    setIsOpen(false);
  };

  return (
    <div
      className="relative rounded-lg border border-white/10 bg-white/[0.06] p-2"
      ref={rootRef}
    >
      <span className="mb-1.5 block text-[11px] font-semibold uppercase text-[#69B1FF]">
        프로젝트
      </span>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex min-h-11 w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 py-2 text-left outline-none transition-colors hover:border-white/20 focus-visible:ring-3 focus-visible:ring-[#69B1FF]/40"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Folder className="size-4 shrink-0 text-[#BAE0FF]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">
            {selectedProject?.name ?? "프로젝트 선택"}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-medium text-white/65">
            {selectedProject?.slackChannelName
              ? `#${selectedProject.slackChannelName}`
              : "Slack 채널 연결 대기"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-white/65 transition-transform duration-150",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div
          aria-label="프로젝트 선택"
          className="absolute left-2 right-2 top-[calc(100%-2px)] z-50 max-h-64 overflow-y-auto rounded-lg border border-[#D9D9D9] bg-white p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.08),0_9px_28px_rgba(0,0,0,0.05)]"
          id={menuId}
          role="listbox"
        >
          {projects.map((project) => {
            const isSelected = project.id === selectedProjectId;

            return (
              <button
                aria-selected={isSelected}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#1677FF]/30",
                  isSelected
                    ? "bg-[#E6F4FF] text-[#0958D9]"
                    : "text-[#000000A6] hover:bg-[#0000000A] hover:text-[#000000E0]",
                )}
                key={project.id}
                onClick={() => chooseProject(project.id)}
                role="option"
                type="button"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#E6F4FF] text-[#0958D9]">
                  <Folder className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {project.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--bf-text-secondary)]">
                    {project.slackChannelName
                      ? `#${project.slackChannelName}`
                      : "Slack 채널 연결 대기"}
                  </span>
                </span>
                {isSelected ? (
                  <Check className="size-4 shrink-0 text-[#1677FF]" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
