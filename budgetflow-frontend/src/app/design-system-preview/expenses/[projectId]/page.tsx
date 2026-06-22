import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";

import {
  DetailPanel,
  ExpenseTable,
  ExportReadinessPanel,
  PreviewShell,
  SummaryGrid,
  TrustStrip,
  mockProjects,
  routeBase,
} from "../../_components";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return mockProjects.map((project) => ({ projectId: project.id }));
}

export const metadata = {
  title: "Project Expenses Preview | BudgetFlow",
};

export default async function PreviewProjectExpensesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project =
    mockProjects.find((candidate) => candidate.id === projectId) ??
    mockProjects[0];

  return (
    <PreviewShell
      active="지출 검토"
      actions={
        <>
          <Button variant="outline">
            <RefreshCw data-icon="inline-start" />
            새로고침
          </Button>
          <Button asChild>
            <Link href={`${routeBase}/settings`}>
              <Download data-icon="inline-start" />
              승인 4건 엑셀 생성
            </Link>
          </Button>
        </>
      }
      eyebrow={`Expenses / #${project.slackChannelName}`}
      title={project.name}
    >
      <TrustStrip />
      <SummaryGrid />
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <ExpenseTable />
          <ExportReadinessPanel />
        </div>
        <DetailPanel />
      </section>
    </PreviewShell>
  );
}
