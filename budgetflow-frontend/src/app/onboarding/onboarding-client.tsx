"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Variants, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  AlertTriangle,
  Bot,
  Building2,
  Calculator,
  Clock,
  FileSpreadsheet,
  FileWarning,
  Landmark,
  ListChecks,
  MessageSquare,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const sessionStorageKey = "budgetflow.session";

const PILLARS = [
  {
    icon: Bot,
    label: "AI 분석",
    sub: "Receipt Intelligence",
    desc: "Slack에 올린 영수증을 OCR·LLM으로 인식하고 금액·항목·증빙·VAT 후보까지 자동 분류합니다.",
  },
  {
    icon: ListChecks,
    label: "세무 검토 큐",
    sub: "Human-in-the-loop",
    desc: "증빙 누락·OCR 실패·VAT 검토 후보를 분리해, 사람이 봐야 할 항목만 남깁니다.",
  },
  {
    icon: Calculator,
    label: "비용 절감",
    sub: "Tax-ready Packet",
    desc: "세무 준비도와 절감액을 보여주고, 세무사 전달·직접신고 준비 패킷을 생성합니다.",
  },
] as const;

const FLOW = [
  { icon: MessageSquare, title: "Slack 전송", desc: "영수증 사진·지출 내용 입력" },
  { icon: Bot, title: "AI 분석", desc: "금액·항목·증빙·VAT 후보 분류" },
  { icon: ListChecks, title: "검토 큐", desc: "검토 필요 항목만 확인·처리" },
  { icon: FileSpreadsheet, title: "세무 준비 패킷", desc: "세무사 전달·직접신고 자료 생성" },
] as const;

const STATS = [
  { value: "97.06%", label: "필드 평균 정답률" },
  { value: "83.94%", label: "자동 처리 가능률" },
  { value: "0.00%", label: "false-ready 비율" },
] as const;

const PROBLEMS = [
  {
    icon: Clock,
    title: "마감은 반복된다",
    desc: "부가세·원천세·법인세 일정이 매달·분기마다 돌아옵니다.",
  },
  {
    icon: FileWarning,
    title: "증빙이 새어나간다",
    desc: "누락 영수증·적격증빙 미수취는 가산세 위험으로 이어집니다.",
  },
  {
    icon: ReceiptText,
    title: "정리에 시간이 든다",
    desc: "영수증 입력·분류·대조는 매달 반복되는 수작업입니다.",
  },
  {
    icon: AlertTriangle,
    title: "위험을 월말에야 안다",
    desc: "어떤 지출이 공제·소명 위험인지 신고 직전에야 드러납니다.",
  },
] as const;

const PERSONAS = [
  {
    icon: Building2,
    title: "소규모 법인 재무담당자",
    sub: "Finance Lead",
    points: [
      "증빙 누락·VAT 검토 후보를 한눈에",
      "마감 전 세무 준비도 확인",
      "세무사 전달 패킷 자동 생성",
    ],
  },
  {
    icon: UserRound,
    title: "개인사업자 대표",
    sub: "Owner",
    points: [
      "반복 정리 업무를 제품이 대신",
      "공제 후보·차단 항목을 먼저 분리",
      "세무 비용 절감 근거 확보",
    ],
  },
  {
    icon: Landmark,
    title: "협업 세무사",
    sub: "Accountant",
    points: [
      "사유가 정리된 검토 큐 수신",
      "최종 분류·세무조정에 집중",
      "정리되지 않은 영수증 더미 제거",
    ],
  },
] as const;

export function OnboardingClient() {
  const router = useRouter();
  const reduce = useReducedMotion();
  // 하이드레이션 불일치 방지: 서버/첫 클라이언트 렌더는 애니메이션 없이 동일 마크업을 그리고,
  // 마운트 이후에만 모션을 활성화한다. (useSyncExternalStore: 서버 false → 클라 true)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (localStorage.getItem(sessionStorageKey)) {
      router.replace("/home");
    }
  }, [router]);

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    show: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: reduce ? 0 : 0.5,
        delay: reduce ? 0 : i * 0.08,
        ease: [0.215, 0.61, 0.355, 1],
      },
    }),
  };

  // 로드 직후 1회 재생(히어로)
  const load = (i = 0) =>
    mounted
      ? ({
          variants: fadeUp,
          custom: i,
          initial: "hidden" as const,
          animate: "show" as const,
        } as const)
      : {};

  // 스크롤 진입 시 재생(섹션)
  const reveal = (i = 0) =>
    mounted
      ? ({
          variants: fadeUp,
          custom: i,
          initial: "hidden" as const,
          whileInView: "show" as const,
          viewport: { once: true, margin: "-60px" },
        } as const)
      : {};

  return (
    <div className="min-h-dvh bg-white">
      {/* Top nav */}
      <nav className="fixed top-0 z-40 w-full border-b border-white/10 bg-[#001529]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <span className="text-[15px] font-semibold text-white">
            <b>Budget</b>
            <span className="text-[#69B1FF]">Flow</span>
          </span>
          <Button
            asChild
            className="h-9 bg-white font-semibold text-[#1677FF] hover:bg-white/90"
            size="sm"
          >
            <Link href="/login">로그인 →</Link>
          </Button>
        </div>
      </nav>

      {/* Hero — kia-style full-bleed dark editorial */}
      <section className="relative flex min-h-dvh items-center overflow-hidden bg-[#001529] px-6 pt-16 text-white">
        {/* ambient glow (장식 — 마운트 후에만) */}
        {mounted && (
          <>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-[#1677FF]/25 blur-[140px]"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: reduce ? 0.5 : 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -bottom-48 -left-32 size-[520px] rounded-full bg-[#0958D9]/20 blur-[140px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: reduce ? 0.4 : 0.8 }}
              transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
            />
          </>
        )}

        <div className="relative mx-auto w-full max-w-6xl">
          <motion.p
            className="text-sm font-semibold uppercase tracking-[0.3em] text-[#69B1FF]"
            {...load(0)}
          >
            BudgetFlow TaxOps
          </motion.p>
          <motion.h1
            className="mt-5 text-[clamp(2.6rem,7vw,5.5rem)] font-semibold leading-[1.05] tracking-tight"
            {...load(1)}
          >
            지출 정산부터
            <br />
            <span className="text-[#69B1FF]">세무 준비</span>까지, 자동으로
          </motion.h1>
          <motion.p
            className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg"
            {...load(2)}
          >
            소규모 법인·개인사업자가 세무사에게 맡기던 반복 정리 업무를
            제품이 먼저 끝냅니다.
            <span className="mt-1 block text-sm text-white/45">
              We turn raw receipts into tax-ready records, in every corner of your books.
            </span>
          </motion.p>
          <motion.div
            className="mt-10 flex flex-wrap items-center gap-3"
            {...load(3)}
          >
            <Button
              asChild
              className="h-12 bg-[#1677FF] px-6 font-semibold text-white hover:bg-[#4096FF]"
              size="lg"
            >
              <Link href="/login">
                시작하기
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              className="h-12 border-white/25 bg-transparent px-6 font-semibold text-white hover:bg-white/10"
              size="lg"
              variant="outline"
            >
              <a href="#pillars">기능 둘러보기</a>
            </Button>
          </motion.div>

          {mounted && (
            <motion.div
              aria-hidden
              className="mt-16 hidden items-center gap-2 text-xs text-white/40 sm:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 1, duration: 0.6 }}
            >
              <span className="h-8 w-px bg-white/20" />
              아래로 스크롤해 둘러보기
            </motion.div>
          )}
        </div>
      </section>

      {/* Problem — pain points (ref: 하루보안) */}
      <section className="border-b border-[#D9D9D9] bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.p
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#000000A6]"
            {...reveal()}
          >
            Problem
          </motion.p>
          <motion.h2
            className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-[#000000E0] sm:text-4xl"
            {...reveal()}
          >
            문제는 영수증 보관이 아니라, 신고 전 리스크입니다
          </motion.h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((problem, index) => {
              const Icon = problem.icon;
              return (
                <motion.div
                  key={problem.title}
                  className="rounded-2xl border border-[#D9D9D9] bg-[#FAFAFA] p-6"
                  {...reveal(index)}
                >
                  <Icon className="size-7 text-[#FAAD14]" />
                  <h3 className="mt-3 text-base font-semibold text-[#000000E0]">
                    {problem.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#000000A6]">
                    {problem.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pillars — kia "lounge" style 3 cards */}
      <section id="pillars" className="border-b border-[#D9D9D9] bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.p
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#000000A6]"
            {...reveal()}
          >
            Why BudgetFlow
          </motion.p>
          <motion.h2
            className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-[#000000E0] sm:text-4xl"
            {...reveal()}
          >
            영수증을 모으는 데서 끝나지 않습니다
          </motion.h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PILLARS.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <motion.article
                  key={pillar.label}
                  className="group relative overflow-hidden rounded-2xl border border-[#D9D9D9] bg-[#FAFAFA] p-8 transition-colors hover:border-[#1677FF]"
                  {...reveal(index)}
                >
                  <span className="grid size-12 place-items-center rounded-xl bg-[#E6F4FF] text-[#1677FF]">
                    <Icon className="size-6" />
                  </span>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[#1677FF]">
                    {pillar.sub}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-[#000000E0]">
                    {pillar.label}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#000000A6]">
                    {pillar.desc}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Personas — who it's for (ref: 하루보안 For Everyone) */}
      <section className="border-b border-[#D9D9D9] bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.p
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#000000A6]"
            {...reveal()}
          >
            For Everyone
          </motion.p>
          <motion.h2
            className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-[#000000E0] sm:text-4xl"
            {...reveal()}
          >
            누구를 위한 제품인가요
          </motion.h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PERSONAS.map((persona, index) => {
              const Icon = persona.icon;
              return (
                <motion.article
                  key={persona.title}
                  className="rounded-2xl border border-[#D9D9D9] bg-white p-8"
                  {...reveal(index)}
                >
                  <span className="grid size-12 place-items-center rounded-xl bg-[#E6F4FF] text-[#1677FF]">
                    <Icon className="size-6" />
                  </span>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[#1677FF]">
                    {persona.sub}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-[#000000E0]">
                    {persona.title}
                  </h3>
                  <ul className="mt-4 space-y-2">
                    {persona.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2 text-sm leading-6 text-[#000000A6]"
                      >
                        <ListChecks className="mt-0.5 size-4 shrink-0 text-[#52C41A]" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Flow — animated pipeline */}
      <section className="border-b border-[#D9D9D9] bg-[#F5F5F5] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-[#000000E0] sm:text-4xl"
            {...reveal()}
          >
            이렇게 작동합니다
          </motion.h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  className="relative rounded-2xl border border-[#D9D9D9] bg-white p-6"
                  {...reveal(index)}
                >
                  <span className="text-xs font-bold tabular-nums text-[#1677FF]">
                    0{index + 1}
                  </span>
                  <Icon className="mt-3 size-7 text-[#0958D9]" />
                  <h3 className="mt-3 text-base font-semibold text-[#000000E0]">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#000000A6]">
                    {step.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-[#001529] px-6 py-20 text-white">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {STATS.map((stat, index) => (
            <motion.div key={stat.label} className="text-center" {...reveal(index)}>
              <p className="text-4xl font-semibold tabular-nums text-[#69B1FF] sm:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-white/60">{stat.label}</p>
            </motion.div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-5 text-white/40">
          합성 영수증 720건 + SROIE 973건, 12회 반복 검증 기준. 신고대행이 아니라
          반복 세무 준비 업무 자동화 효과입니다.
        </p>
      </section>

      {/* Final CTA */}
      <section className="bg-[#0958D9] px-6 py-24 text-center text-white">
        <motion.div className="mx-auto max-w-2xl" {...reveal()}>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            지금 데모로 시작해 보세요
          </h2>
          <p className="mt-3 text-base text-white/75">
            데모 계정으로 로그인하면 프로젝트 생성부터 지출 검토까지
            가이드 투어가 함께합니다.
          </p>
          <Button
            asChild
            className="mt-9 h-12 bg-white px-7 font-semibold text-[#0958D9] hover:bg-white/90"
            size="lg"
          >
            <Link href="/login">
              데모 시작하기
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </motion.div>
      </section>

      <footer className="bg-[#001529] px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <span className="text-[15px] font-semibold text-white/80">
            <b>Budget</b>
            <span className="text-[#69B1FF]">Flow</span>
          </span>

          {/* 세무 면책 고지 */}
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-[#69B1FF]">
              <ShieldCheck className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                세무 면책 고지
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/55">
              BudgetFlow는 세무 신고 대행 서비스가 아닙니다. VAT 공제 후보, 세무
              검토 상태, 비용 절감액은 확정된 세무 판단이 아니라 검토를 돕기 위한
              추정·후보 정보이며, 최종 계정과목 확정·세무조정·신고 및 세법 판단의
              책임은 관할 세무사 또는 납세자 본인에게 있습니다. 화면에 표시되는
              수치는 합성·공개 데이터 기반 추정값으로 실제와 다를 수 있습니다.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45">
            <span>© 2026 BudgetFlow · 인하대학교 클라우드컴퓨팅 프로젝트</span>
            <a className="hover:text-white/80" href="#">
              이용약관
            </a>
            <a className="hover:text-white/80" href="#">
              개인정보 처리방침
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
