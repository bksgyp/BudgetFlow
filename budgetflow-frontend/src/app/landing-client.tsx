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
    desc: "금액·항목·증빙·VAT 후보 자동 분류",
  },
  { icon: "✅", title: "검토 큐 처리", desc: "증빙 누락·검토 필요 항목만 확인" },
  { icon: "📑", title: "세무 준비 패킷", desc: "세무사 전달·직접신고 자료 생성" },
];

const FEATURES = [
  {
    icon: "🤖",
    title: "AI 자동 분석",
    desc: "Bedrock Claude + Textract OCR로 영수증을 인식하고 항목·증빙·VAT 후보를 분류합니다.",
  },
  {
    icon: "✅",
    title: "세무 검토 큐",
    desc: "증빙 누락, OCR 실패, VAT 검토 후보를 분리해 사람이 볼 항목만 남깁니다.",
  },
  {
    icon: "📊",
    title: "세무 준비·비용 절감",
    desc: "세무 준비도와 절감액을 보여주고, 세무사 전달·직접신고 준비 패킷을 생성합니다.",
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
      router.replace("/home");
    }
  }, [router]);

  return (
    <div className="min-h-dvh bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-[#D9D9D9] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <BrandLink />
          <Button asChild size="sm">
            <Link href="/login">로그인</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#001529] px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 inline-block rounded border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white/80">
            인하대학교 클라우드컴퓨팅 프로젝트
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            지출 정산부터
            <br />
            세무 준비까지, 자동으로
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Slack에 영수증을 올리면 AI가 분석하고,
            <br />
            소규모 법인·개인사업자의 세무 준비까지 한 번에 끝냅니다.
          </p>
          <Button
            asChild
            className="mt-8 h-12 bg-white font-semibold text-[#1677FF] hover:bg-white/90"
            size="lg"
          >
            <Link href="/login">관리자 로그인 →</Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-[#D9D9D9] bg-white px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#000000A6]">
            작동 방식
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#000000E0]">
            이렇게 작동합니다
          </h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {FLOW_STEPS.map((s, i) => (
              <Fragment key={s.title}>
                <div className="flex-1 rounded-lg border border-[#D9D9D9] bg-[#FAFAFA] p-4 text-center">
                  <div className="text-2xl">{s.icon}</div>
                  <strong className="mt-2 block text-sm font-semibold text-[#000000E0]">
                    {s.title}
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-[#000000A6]">
                    {s.desc}
                  </span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <span className="hidden text-[#00000040] sm:block">→</span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-[#D9D9D9] bg-[#F5F5F5] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#000000A6]">
            핵심 기능
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#000000E0]">
            주요 기능
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-[#D9D9D9] bg-white p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#E6F4FF] text-xl">
                  {f.icon}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#000000E0]">
                  {f.title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#000000A6]">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-b border-[#D9D9D9] bg-white px-6 py-14 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#000000A6]">
            기술 스택
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#000000E0]">
            사용 기술
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="rounded border border-[#D9D9D9] bg-[#FAFAFA] px-3 py-1 text-xs font-medium text-[#000000A6]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#001529] px-6 py-16 text-center text-white">
        <div className="mx-auto max-w-lg">
          <h2 className="text-2xl font-semibold">지금 바로 시작하세요</h2>
          <p className="mt-2 text-sm text-white/70">
            관리자 계정으로 로그인하여 예산 정산을 시작합니다.
          </p>
          <Button
            asChild
            className="mt-8 h-12 bg-white font-semibold text-[#1677FF] hover:bg-white/90"
            size="lg"
          >
            <Link href="/login">관리자 로그인 →</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
