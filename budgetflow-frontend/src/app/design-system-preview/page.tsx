import Link from "next/link";
import {
  ArrowRight,
  FileSpreadsheet,
  FolderOpen,
  Hash,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

import {
  ExpenseTable,
  PreviewShell,
  ProjectTable,
  SummaryGrid,
  TrustStrip,
  routeBase,
} from "./_components";
import { Panel } from "@/components/budgetflow-ui";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "BudgetFlow Ant Redesign",
};

export default function DesignSystemPreviewHomePage() {
  return (
    <PreviewShell
      active="홈"
      actions={
        <>
          <Button asChild variant="outline">
            <Link href={`${routeBase}/projects`}>
              <FolderOpen data-icon="inline-start" />
              프로젝트 보기
            </Link>
          </Button>
          <Button asChild>
            <Link href={`${routeBase}/expenses`}>
              <ReceiptText data-icon="inline-start" />
              지출 검토
            </Link>
          </Button>
        </>
      }
      eyebrow="Ant Design Workspace"
      title="BudgetFlow 운영 홈"
    >
      <TrustStrip />
      <SummaryGrid />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <ShieldCheck className="size-4 text-[var(--bf-text-secondary)]" />
                  오늘 처리할 작업
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--bf-text-secondary)]">
                  Slack 입력, 증빙 확인, 승인 항목 생성 상태를 한 곳에서
                  확인합니다.
                </p>
              </div>
              <Button asChild className="w-full sm:w-auto" size="sm" variant="outline">
                <Link href={`${routeBase}/expenses`}>
                  상세 보기
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["증빙 누락 보완", "1건", "영수증 없음 항목 먼저 결정"],
                ["검토 필요", "2건", "예산 초과 가능성 확인"],
                ["엑셀 생성 가능", "4건", "승인 항목만 포함"],
              ].map(([title, count, desc]) => (
                <div
                  className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] p-3"
                  key={title}
                >
                  <p className="text-sm text-[var(--bf-text-secondary)]">
                    {title}
                  </p>
                  <p className="mt-2 text-xl font-semibold">{count}</p>
                  <p className="mt-1 text-xs text-[var(--bf-text-secondary)]">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <ExpenseTable compact />
        </div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Hash className="size-4 text-[var(--bf-text-secondary)]" />
              Slack 수집 상태
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["#finance-ops", "2분 전 동기화"],
                ["#expense-q1", "마감 프로젝트"],
                ["감사 로그", "최근 승인 4건 기록"],
              ].map(([label, value]) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-02)] px-3 py-2"
                  key={label}
                >
                  <span className="text-[var(--bf-text-secondary)]">
                    {label}
                  </span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <FileSpreadsheet className="size-4 text-[var(--bf-text-secondary)]" />
              제출 파일 경계
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--bf-text-secondary)]">
              검토 필요와 증빙 없음 항목은 제출 파일에서 제외됩니다. 생성 전
              포함/제외 건수를 확인합니다.
            </p>
          </Panel>
        </aside>
      </section>

      <ProjectTable />
    </PreviewShell>
  );
}
