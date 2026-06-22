import Link from "next/link";
import { ArrowRight, FileSpreadsheet, FolderPlus } from "lucide-react";

import {
  PreviewShell,
  ProjectTable,
  SummaryGrid,
  TrustStrip,
  routeBase,
} from "../_components";
import { Panel, ProgressBar, StatusBadge } from "@/components/budgetflow-ui";
import { TextInput } from "@/components/form-controls";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Projects Preview | BudgetFlow",
};

export default function PreviewProjectsPage() {
  return (
    <PreviewShell
      active="프로젝트"
      actions={
        <Button asChild>
          <Link href={`${routeBase}/expenses`}>
            검토가 필요한 지출 열기
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      }
      eyebrow="Projects"
      title="사업장 지출·세무 정산 프로젝트"
    >
      <TrustStrip />
      <SummaryGrid />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <ProjectTable />
          <Panel className="p-4">
            <h2 className="text-base font-semibold">프로젝트 생성</h2>
            <p className="mt-1 text-sm text-[var(--bf-text-secondary)]">
              새 사업/정산 단위명과 Slack 채널을 연결하면 지출 입력이 자동으로
              수집됩니다.
            </p>
            <form className="mt-4 space-y-4">
              <FormField label="프로젝트명">
                <TextInput placeholder="예: 2026년 2분기 운영비" />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Slack 채널">
                  <TextInput placeholder="#finance-ops" />
                </FormField>
                <FormField label="총 예산">
                  <TextInput defaultValue="1000000" inputMode="numeric" />
                </FormField>
              </div>
              <FormField label="엑셀 양식 파일명">
                <TextInput placeholder="법인운영비_지출내역서.xlsx" />
              </FormField>
              <Button>
                <FolderPlus data-icon="inline-start" />
                프로젝트 생성
              </Button>
            </form>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <h2 className="text-base font-semibold">운영 체크</h2>
            <div className="mt-4 space-y-4">
              {[
                ["본사 운영비 정산 · 2026", 68, "검토 필요 2건"],
                ["2026년 1분기 경비 정산", 100, "마감"],
                ["양식 매핑", 75, "2/2 확정"],
              ].map(([label, value, status]) => (
                <div className="space-y-2" key={label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <strong>{label}</strong>
                    <StatusBadge tone={value === 100 ? "approved" : "processing"}>
                      {status}
                    </StatusBadge>
                  </div>
                  <ProgressBar
                    tone={value === 100 ? "approved" : "processing"}
                    value={Number(value)}
                  />
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <FileSpreadsheet className="size-4 text-[var(--bf-text-secondary)]" />
              엑셀 양식 상태
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--bf-text-secondary)]">
              모든 활성 프로젝트의 양식 매핑이 확정되어 승인 항목 생성이
              가능합니다.
            </p>
          </Panel>
        </aside>
      </section>
    </PreviewShell>
  );
}
