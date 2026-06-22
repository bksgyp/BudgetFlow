import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";

import {
  DetailPanel,
  ExpenseTable,
  ExportReadinessPanel,
  PreviewShell,
  SummaryGrid,
  TrustStrip,
  routeBase,
} from "../_components";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Expenses Preview | BudgetFlow",
};

export default function PreviewExpensesPage() {
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
            <Link href={`${routeBase}/expenses/project-aingthon`}>
              <Download data-icon="inline-start" />
              승인 4건 엑셀 생성
            </Link>
          </Button>
        </>
      }
      eyebrow="Expenses"
      title="지출 목록과 관리자 검토"
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
