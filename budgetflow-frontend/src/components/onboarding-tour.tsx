"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Calculator, Compass, PartyPopper } from "lucide-react";

import { isLiveDataEnabled } from "@/lib/api/http-client";
import { setDemoMode } from "@/lib/api/budgetflow-api";

const TOUR_KEY = "budgetflow.tour_seen";

type TourStep = {
  path: string;
  tourId: string;
  badge: string;
  title: string;
  body: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    path: "/projects",
    tourId: "create-project",
    badge: "프로젝트 생성",
    title: "먼저 정산 단위를 만듭니다",
    body: "사업/정산 단위명과 Slack 채널, 총 예산, 엑셀 양식을 입력해 프로젝트를 만듭니다. 채널에 올라온 영수증이 이 프로젝트로 모입니다.",
  },
  {
    path: "/projects",
    tourId: "projects-list",
    badge: "프로젝트 현황",
    title: "예산과 양식 상태를 한눈에",
    body: "예산 사용 흐름, 엑셀 양식 확정 여부, 진행/마감 상태를 확인합니다. 행을 클릭하면 해당 프로젝트의 지출 화면으로 이동합니다.",
  },
  {
    path: "/expenses",
    tourId: "expense-list",
    badge: "지출 검토 큐",
    title: "AI 분류 결과를 검토합니다",
    body: "증빙 없음·검토 필요 항목이 색으로 구분됩니다. 항목을 클릭하면 상세 모달에서 금액·카테고리를 수정하고 승인 또는 반려할 수 있습니다.",
  },
  {
    path: "/expenses",
    tourId: "export-controls",
    badge: "정산 마감·엑셀",
    title: "승인 항목만 내보냅니다",
    body: "검토 필요 항목은 제외된다는 경고를 확인한 뒤, 승인된 지출만 모아 제출용 엑셀을 생성합니다.",
  },
  {
    path: "/tax",
    tourId: "tax-readiness",
    badge: "세무 준비",
    title: "세무 준비도와 절감액 확인",
    body: "준비도 점수·자동 처리 가능 건수·신고 차단 건수를 보고, 세무사 전달 패킷과 직접신고 준비 패킷을 생성합니다.",
  },
];

type Phase = "intro" | "running" | "done" | null;
type Pos = { top: number; left: number };

const TOOLTIP_W = 320;
const TOOLTIP_H = 230;
const GAP = 16;
const MARGIN = 16;

function computeTooltipPos(rect: DOMRect | null): Pos {
  if (typeof window === "undefined") return { top: 0, left: 0 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 모바일이거나 대상이 없으면 하단 중앙
  if (!rect || vw < 640) {
    return {
      top: vh - TOOLTIP_H - MARGIN,
      left: Math.max(MARGIN, (vw - TOOLTIP_W) / 2),
    };
  }

  const clampTop = (t: number) =>
    Math.min(Math.max(t, MARGIN), vh - TOOLTIP_H - MARGIN);
  const clampLeft = (l: number) =>
    Math.min(Math.max(l, MARGIN), vw - TOOLTIP_W - MARGIN);

  // 오른쪽 → 왼쪽 → 아래 → 위 순으로 공간이 있는 곳에 배치
  if (rect.right + GAP + TOOLTIP_W <= vw - MARGIN) {
    return { top: clampTop(rect.top), left: rect.right + GAP };
  }
  if (rect.left - GAP - TOOLTIP_W >= MARGIN) {
    return { top: clampTop(rect.top), left: rect.left - GAP - TOOLTIP_W };
  }
  if (rect.bottom + GAP + TOOLTIP_H <= vh - MARGIN) {
    return { top: rect.bottom + GAP, left: clampLeft(rect.left) };
  }
  return { top: clampTop(rect.top - GAP - TOOLTIP_H), left: clampLeft(rect.left) };
}

export function OnboardingTour() {
  const [phase, setPhase] = useState<Phase>(null);
  const [step, setStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<Pos | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // 첫 방문: (실데이터가 켜진 환경에서만) mock 강제 후 인트로 시작.
  // 현재는 mock이 기본이라 리페치 없이 즉시 시작한다.
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;
    const start = window.setTimeout(() => {
      if (isLiveDataEnabled) {
        setDemoMode(true);
        void queryClient.invalidateQueries();
      }
      setPhase("intro");
    }, 100);
    return () => window.clearTimeout(start);
  }, [queryClient]);

  // 진행 단계가 바뀌면 해당 경로로 이동
  useEffect(() => {
    if (phase !== "running") return;
    const targetPath = TOUR_STEPS[step].path;
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
  }, [phase, step, pathname, router]);

  // 경로가 맞으면 대상 요소를 폴링하며 찾아 위치 계산 (목업 로딩 대기)
  useEffect(() => {
    if (phase !== "running") return;
    if (pathname !== TOUR_STEPS[step].path) return;

    let cancelled = false;
    let tries = 0;
    const selector = `[data-tour="${TOUR_STEPS[step].tourId}"]`;

    const measure = (el: Element) => {
      const rect = el.getBoundingClientRect();
      setHighlightRect(rect);
      setTooltipPos(computeTooltipPos(rect));
    };

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          if (!cancelled) measure(el);
        }, 120);
        return;
      }
      tries += 1;
      if (tries < 40) {
        window.setTimeout(tick, 70);
      } else {
        setHighlightRect(null);
        setTooltipPos(computeTooltipPos(null));
      }
    };

    const onMove = () => {
      const el = document.querySelector(selector);
      if (el) measure(el);
    };

    const startTimer = window.setTimeout(tick, 40);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, { passive: true });
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove);
    };
  }, [phase, step, pathname]);

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "true");
    if (isLiveDataEnabled) {
      setDemoMode(false);
      void queryClient.invalidateQueries();
    }
    setPhase(null);
    setHighlightRect(null);
    setTooltipPos(null);
    setStep(0);
  }, [queryClient]);

  const startSteps = () => {
    setStep(0);
    setPhase("running");
  };

  const advance = () => {
    if (step >= TOUR_STEPS.length - 1) {
      setHighlightRect(null);
      setTooltipPos(null);
      setPhase("done");
      return;
    }
    setHighlightRect(null);
    setTooltipPos(null);
    setStep((current) => current + 1);
  };

  const goToApp = () => {
    finish();
    router.push("/home");
  };

  if (phase === null) return null;

  if (phase === "intro") {
    return (
      <CenterModal onClose={finish}>
        <span className="grid size-12 place-items-center rounded-xl bg-[#E6F4FF] text-[#1677FF]">
          <Compass className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#000000E0]">
          BudgetFlow 2분 둘러보기
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#000000A6]">
          예시 데이터가 채워진 화면에서 프로젝트 생성·지출 검토·세무 준비까지
          핵심 기능을 단계별로 안내합니다. 언제든 건너뛸 수 있어요.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="text-sm text-[#000000A6] hover:text-[#000000E0]"
            onClick={finish}
            type="button"
          >
            건너뛰기
          </button>
          <button
            className="rounded-md bg-[#1677FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4096FF]"
            onClick={startSteps}
            type="button"
          >
            둘러보기 시작 →
          </button>
        </div>
      </CenterModal>
    );
  }

  if (phase === "done") {
    return (
      <CenterModal onClose={goToApp}>
        <span className="grid size-12 place-items-center rounded-xl bg-[#F6FFED] text-[#52C41A]">
          <PartyPopper className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#000000E0]">
          준비 완료!
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#000000A6]">
          이제 직접 프로젝트를 만들고 지출을 검토해 보세요. 세무 준비 화면에서
          절감 효과도 확인할 수 있습니다.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1677FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4096FF]"
            onClick={goToApp}
            type="button"
          >
            <Calculator className="size-4" />
            시작하기
          </button>
        </div>
      </CenterModal>
    );
  }

  const currentStep = TOUR_STEPS[step];
  const isOnCorrectPath = pathname === currentStep.path;
  const pos = tooltipPos ?? computeTooltipPos(highlightRect);

  return (
    <AnimatePresence>
      {isOnCorrectPath && (
        <motion.div
          key="backdrop"
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed inset-0 z-50 bg-black/40"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        />
      )}

      {/* 실제 기능 컴포넌트 외곽선 하이라이트 */}
      {isOnCorrectPath && highlightRect && (
        <motion.div
          key="highlight"
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed z-50 rounded-lg outline outline-2 outline-[#1677FF] outline-offset-2"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
          }}
        >
          <motion.span
            className="absolute inset-0 rounded-lg"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(22,119,255,0.30)",
                "0 0 0 8px rgba(22,119,255,0)",
              ],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        </motion.div>
      )}

      {/* 대상 옆 최적 위치 툴팁 */}
      {isOnCorrectPath && (
        <motion.div
          key={`tooltip-${step}`}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 w-[20rem] rounded-xl border border-[#D9D9D9] bg-white p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08),0_9px_28px_rgba(0,0,0,0.05)]"
          exit={{ opacity: 0, scale: 0.97 }}
          initial={{ opacity: 0, scale: 0.97 }}
          style={{ top: pos.top, left: pos.left }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between">
            <span className="rounded bg-[#E6F4FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#0958D9]">
              {currentStep.badge}
            </span>
            <span className="text-[10px] font-semibold tabular-nums text-[#000000A6]">
              STEP {step + 1} / {TOUR_STEPS.length}
            </span>
          </div>
          <h3 className="mt-2.5 text-sm font-semibold text-[#000000E0]">
            {currentStep.title}
          </h3>
          <p className="mt-1.5 text-xs leading-5 text-[#000000A6]">
            {currentStep.body}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((s, i) => (
                <span
                  key={s.tourId}
                  className={`block h-1.5 w-1.5 rounded-full transition-colors ${
                    i === step ? "bg-[#1677FF]" : "bg-[#D9D9D9]"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                className="text-xs text-[#000000A6] hover:text-[#000000E0]"
                onClick={finish}
                type="button"
              >
                건너뛰기
              </button>
              <button
                className="rounded-md bg-[#1677FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4096FF]"
                onClick={advance}
                type="button"
              >
                {step >= TOUR_STEPS.length - 1 ? "완료 →" : "다음 →"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CenterModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          onClick={(event) => event.stopPropagation()}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
