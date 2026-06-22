import Link from "next/link";
import { Eye, LogIn, ShieldCheck } from "lucide-react";

import { PreviewShell, routeBase } from "../_components";
import { Panel } from "@/components/budgetflow-ui";
import { TextInput } from "@/components/form-controls";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Login Preview | BudgetFlow",
};

export default function PreviewLoginPage() {
  return (
    <PreviewShell active="로그인" eyebrow="Sign in" title="관리자 로그인">
      <section className="grid min-h-[calc(100vh-160px)] items-start gap-4 pt-8 sm:items-center sm:pt-0 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hidden max-w-2xl space-y-4 xl:block">
          <p className="text-sm font-semibold text-[var(--bf-text-muted)]">
            승인 항목 제출 준비
          </p>
          <h2 className="text-2xl font-semibold leading-[1.33]">
            Slack에서 들어온 지출을 검토하고, 승인 항목만 제출 파일로 만듭니다.
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {["승인 경계 명확", "감사 로그 기록", "양식 매핑 확정"].map((item) => (
              <div
                className="rounded-lg border border-[var(--bf-border-subtle)] bg-[var(--bf-layer-01)] p-3"
                key={item}
              >
                <ShieldCheck className="size-4 text-[var(--bf-text-secondary)]" />
                <p className="mt-2 text-sm font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <Panel className="p-6 sm:p-8">
          <div className="mb-6">
            <span className="grid size-10 place-items-center rounded-md bg-[var(--bf-primary)] text-sm font-semibold text-white">
              BF
            </span>
            <h1 className="mt-4 text-[30px] font-semibold leading-[1.27]">
              BudgetFlow 로그인
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--bf-text-secondary)]">
              관리자 계정으로 예산 정산 작업을 계속합니다.
            </p>
          </div>

          <form className="space-y-4">
            <FormField label="이메일">
              <TextInput defaultValue="admin@budgetflow.dev" type="email" />
            </FormField>
            <FormField label="비밀번호">
              <div className="relative">
                <TextInput
                  className="pr-12"
                  defaultValue="budgetflow"
                  type="password"
                />
                <button
                  aria-label="비밀번호 보기"
                  className="absolute right-0 top-0 inline-grid size-11 place-items-center rounded-md text-[var(--bf-text-secondary)] hover:bg-[var(--bf-layer-hover)] active:bg-[var(--bf-layer-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--bf-focus)]/20 sm:size-8"
                  type="button"
                >
                  <Eye className="size-4" />
                </button>
              </div>
            </FormField>
            <Button asChild className="w-full">
              <Link href={`${routeBase}/projects`}>
                <LogIn data-icon="inline-start" />
                로그인
              </Link>
            </Button>
          </form>
        </Panel>
      </section>
    </PreviewShell>
  );
}
