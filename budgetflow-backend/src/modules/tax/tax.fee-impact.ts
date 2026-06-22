import type { FeeImpact } from './tax.types';

const BASE_MONTHLY_FEE   = 375_000;
const TARGET_MONTHLY_FEE = 301_400;

export function calcFeeImpact(): FeeImpact {
  const monthlySaving = BASE_MONTHLY_FEE - TARGET_MONTHLY_FEE;
  return {
    baseMonthlyFee:   BASE_MONTHLY_FEE,
    targetMonthlyFee: TARGET_MONTHLY_FEE,
    monthlySaving,
    annualSaving: monthlySaving * 12,
    basis: '기존 월 세무대리 비용 375,000원 기준. BudgetFlow 적용 후 반복 전처리 업무(증빙 수집·OCR·VAT 1차 분류) 자동화로 73,600원/월 절감 추정.',
  };
}
