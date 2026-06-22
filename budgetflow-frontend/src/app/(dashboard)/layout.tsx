import { PageTransition } from "@/components/page-transition";
import { OnboardingTour } from "@/components/onboarding-tour";
import { SelectedProjectProvider } from "@/lib/hooks/use-selected-project";

import { AppSidebar } from "./app-sidebar";
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SelectedProjectProvider>
      <div className="flex min-h-dvh bg-[var(--bf-background)]">
        {/* 사이드바 — 데스크탑 전용 */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 min-w-0 overflow-x-hidden px-8 py-7 pb-20 md:pb-7 max-sm:px-4 max-sm:py-5">
          <div className="mx-auto w-full max-w-[1320px]">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>

        {/* 모바일 하단 내비 */}
        <div className="fixed bottom-0 left-0 right-0 z-40 shrink-0 border-t border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(22,27,31,0.08)] md:hidden">
          <DashboardNav placement="mobile" />
        </div>

        {/* 온보딩 투어 */}
        <OnboardingTour />
      </div>
    </SelectedProjectProvider>
  );
}
