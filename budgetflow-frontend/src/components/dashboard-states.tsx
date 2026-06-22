"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Callout, PageHeader, Panel } from "@/components/budgetflow-ui";
import { Button } from "@/components/ui/button";

function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded bg-[var(--bf-layer-hover)] ${className}`}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-l-2 border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] p-4">
      <SkeletonBar className="h-3 w-20" />
      <SkeletonBar className="mt-3 h-6 w-28" />
      <SkeletonBar className="mt-2 h-2.5 w-24" />
    </div>
  );
}

/** DESIGN.md §14 — Loading page: 최종 치수의 스켈레톤으로 레이아웃 점프 방지 */
export function DashboardLoadingState({
  eyebrow,
  lead,
  title,
}: {
  eyebrow: string;
  lead?: string;
  title: string;
}) {
  return (
    <section className="bf-page-stack" aria-busy="true">
      <PageHeader eyebrow={eyebrow} lead={lead} title={title} />
      <div className="bf-card-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <Panel className="bf-panel-pad">
        <SkeletonBar className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBar className="h-12 w-full" key={index} />
          ))}
        </div>
      </Panel>
      <p className="bf-helper" role="status">
        데이터를 불러오는 중입니다.
      </p>
    </section>
  );
}

/** DESIGN.md §14 — 백엔드 오류: blameless, 한 문장, 복구 액션(재시도) */
export function DashboardErrorState({
  eyebrow,
  onRetry,
  title,
}: {
  eyebrow: string;
  onRetry: () => void;
  title: string;
}) {
  return (
    <section className="bf-page-stack">
      <PageHeader
        actions={
          <Button onClick={onRetry} variant="outline">
            <RefreshCw data-icon="inline-start" />
            다시 시도
          </Button>
        }
        eyebrow={eyebrow}
        title={title}
      />
      <Callout title="데이터를 불러오지 못했습니다" tone="missing">
        서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.
      </Callout>
    </section>
  );
}

/** DESIGN.md §14 — 빈 상태: 설명 1줄 + 다음 액션 1개 */
export function DashboardEmptyState({
  action,
  children,
  eyebrow,
  lead,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  lead?: string;
  title: string;
}) {
  return (
    <section className="bf-page-stack">
      <PageHeader actions={action} eyebrow={eyebrow} lead={lead} title={title} />
      <Panel className="bf-panel-pad">
        <p className="bf-helper">{children}</p>
      </Panel>
    </section>
  );
}
