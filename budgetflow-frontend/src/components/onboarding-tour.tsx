"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TOUR_KEY = "budgetflow.tour_seen";

const TOUR_STEPS = [
  {
    path: "/projects",
    tourId: "projects-list",
    title: "프로젝트 관리",
    body: "프로젝트를 만들고 예산을 설정하세요. Slack 채널과 연결하면 팀원이 지출을 바로 올릴 수 있습니다.",
  },
  {
    path: "/expenses",
    tourId: "expense-list",
    title: "지출 검토·승인",
    body: "AI가 분석한 지출 내역을 확인하고 승인 또는 반려하세요. 클릭하면 상세 정보를 볼 수 있습니다.",
  },
  {
    path: "/expenses",
    tourId: "export-controls",
    title: "엑셀 정산 보고서",
    body: "승인된 지출이 있으면 엑셀 버튼이 활성화됩니다. 클릭하면 제출용 정산 보고서가 다운로드됩니다.",
  },
] as const;

export function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // 첫 마운트: localStorage에 tour_seen 없으면 투어 시작
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;

    const startTour = window.setTimeout(() => {
      setStep(0);
    }, 0);

    return () => window.clearTimeout(startTour);
  }, []);

  // step이 바뀌면 해당 경로로 이동
  useEffect(() => {
    if (step === null) return;
    const targetPath = TOUR_STEPS[step].path;
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
  }, [step, pathname, router]);

  // 경로가 맞으면 대상 요소 위치 계산
  useEffect(() => {
    if (step === null) return;
    if (pathname !== TOUR_STEPS[step].path) return;

    const update = () => {
      const el = document.querySelector(
        `[data-tour="${TOUR_STEPS[step].tourId}"]`,
      );
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightRect(el.getBoundingClientRect());
    };

    // 페이지 렌더 후 DOM 접근을 위해 짧은 지연
    const t = setTimeout(update, 120);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [step, pathname]);

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setStep(null);
    setHighlightRect(null);
  };

  const advance = () => {
    if (step === null) return;
    if (step >= TOUR_STEPS.length - 1) {
      dismiss();
    } else {
      setHighlightRect(null);
      setStep(step + 1);
    }
  };

  if (step === null) return null;

  const currentStep = TOUR_STEPS[step];
  const isOnCorrectPath = pathname === currentStep.path;

  return (
    <AnimatePresence>
      {/* 배경 어둡게 */}
      {isOnCorrectPath && (
        <motion.div
          key="backdrop"
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed inset-0 z-50 bg-black/45"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        />
      )}

      {/* 하이라이트 링 */}
      {isOnCorrectPath && highlightRect && (
        <motion.div
          key="highlight"
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed z-50 rounded-lg outline outline-2 outline-green-400 outline-offset-2 shadow-[0_0_0_4px_rgba(74,222,128,0.15)]"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
          }}
        />
      )}

      {/* 툴팁 카드 */}
      {isOnCorrectPath && (
        <motion.div
          key={`tooltip-${step}`}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-8 left-8 z-50 w-72 rounded-xl bg-white p-4 shadow-2xl"
          exit={{ opacity: 0, y: 8 }}
          initial={{ opacity: 0, y: 8 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#126B5D]">
            STEP {step + 1} / {TOUR_STEPS.length}
          </p>
          <h3 className="mt-1 text-sm font-bold text-[#161B1F]">
            {currentStep.title}
          </h3>
          <p className="mt-1.5 text-xs leading-5 text-[#6B7B85]">
            {currentStep.body}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((s, i) => (
                <span
                  key={s.tourId}
                  className={`block h-1.5 w-1.5 rounded-full transition-colors ${
                    i === step ? "bg-[#126B5D]" : "bg-[#E1E6EA]"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                className="text-xs text-[#9AA6AF] hover:text-[#6B7B85]"
                onClick={dismiss}
                type="button"
              >
                건너뛰기
              </button>
              <button
                className="rounded-md bg-[#126B5D] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0d5a4e]"
                onClick={advance}
                type="button"
              >
                {step >= TOUR_STEPS.length - 1 ? "완료 ✓" : "다음 →"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
