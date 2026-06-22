"use client";

import { Fragment, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BrandLink } from "@/components/budgetflow-ui";
import { Button } from "@/components/ui/button";

const sessionStorageKey = "budgetflow.session";

const FLOW_STEPS = [
  { icon: "💬", title: "Slack 전송", desc: "영수증 사진 또는 지출 내용 입력" },
  {
    icon: "🤖",
    title: "AI 분석",
    desc: "Bedrock Claude가 금액·항목 자동 분류",
  },
  { icon: "✅", title: "관리자 검토", desc: "웹 대시보드에서 승인·반려 처리" },
  { icon: "📊", title: "엑셀 다운로드", desc: "정산 보고서를 바로 다운로드" },
];

const FEATURES = [
  {
    icon: "🤖",
    title: "AI 자동 분석",
    desc: "Bedrock Claude + Textract OCR로 영수증을 자동 인식하고 예산 항목에 분류합니다.",
  },
  {
    icon: "✅",
    title: "실시간 검토·승인",
    desc: "needs_review 상태의 지출을 한눈에 보고 승인 또는 반려 처리합니다.",
  },
  {
    icon: "📊",
    title: "엑셀 정산 보고서",
    desc: "프로젝트별 승인된 지출을 ExcelJS로 제출용 보고서로 내보냅니다.",
  },
];

const TECH_STACK = [
  "Next.js 15",
  "React 19",
  "Tailwind CSS",
  "Express.js",
  "PostgreSQL",
  "JWT",
  "AWS Bedrock Claude",
  "AWS Textract",
  "Slack Bolt",
  "ExcelJS",
];

export function LandingClient() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem(sessionStorageKey)) {
      router.replace("/projects");
    }
  }, [router]);

  return (
    <div className="min-h-dvh bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-[#E1E6EA] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <BrandLink />
          <Button asChild size="sm">
            <Link href="/login">로그인</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0d4f45] via-[#126B5D] to-[#1a8a78] px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-white/80">
            인하대학교 클라우드컴퓨팅 프로젝트
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            지출 정산,
            <br />
            이제 자동으로
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Slack 채널에 영수증을 올리면
            <br />
            AI가 분석하고 관리자가 한 번에 정산합니다.
          </p>
          <Button
            asChild
            className="mt-8 h-12 bg-white font-bold text-[#126B5D] hover:bg-white/90"
            size="lg"
          >
            <Link href="/login">관리자 로그인 →</Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-[#E1E6EA] bg-white px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9AA6AF]">
            작동 방식
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#161B1F]">
            이렇게 작동합니다
          </h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {FLOW_STEPS.map((s, i) => (
              <Fragment key={s.title}>
                <div className="flex-1 rounded-xl border border-[#E1E6EA] bg-[#F8FAFB] p-4 text-center">
                  <div className="text-2xl">{s.icon}</div>
                  <strong className="mt-2 block text-sm font-bold text-[#161B1F]">
                    {s.title}
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-[#6B7B85]">
                    {s.desc}
                  </span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <span className="hidden text-[#9AA6AF] sm:block">→</span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-[#E1E6EA] bg-[#F8FAFB] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9AA6AF]">
            핵심 기능
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#161B1F]">
            주요 기능
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-[#E1E6EA] bg-white p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E6F4EC] text-xl">
                  {f.icon}
                </div>
                <h3 className="mt-3 text-sm font-bold text-[#161B1F]">
                  {f.title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#6B7B85]">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-b border-[#E1E6EA] bg-white px-6 py-14 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9AA6AF]">
            기술 스택
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#161B1F]">
            사용 기술
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-[#E1E6EA] bg-[#EFF2F4] px-3 py-1 text-xs font-semibold text-[#4D575F]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#0d4f45] to-[#126B5D] px-6 py-16 text-center text-white">
        <div className="mx-auto max-w-lg">
          <h2 className="text-2xl font-extrabold">지금 바로 시작하세요</h2>
          <p className="mt-2 text-sm text-white/70">
            관리자 계정으로 로그인하여 예산 정산을 시작합니다.
          </p>
          <Button
            asChild
            className="mt-8 h-12 bg-white font-bold text-[#126B5D] hover:bg-white/90"
            size="lg"
          >
            <Link href="/login">관리자 로그인 →</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
