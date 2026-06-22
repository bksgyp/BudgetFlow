import { classify } from './tax.classifier';
import { generateFindings } from './tax.findings';
import type { TaxExpenseRow } from './tax.types';

const INVOICE_TYPES   = ['card_receipt', 'cash_receipt', 'tax_invoice', 'simple_receipt', 'unknown'] as const;
const PAYMENT_METHODS = ['corporate_card', 'personal_card', 'cash', 'transfer', 'unknown'] as const;
const OCR_QUALITIES   = ['good', 'partial', 'poor', 'failed'] as const;

function generateSyntheticData(count: number): TaxExpenseRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `test_${i}`, project_id: 'test_project',
    date:     i % 11 !== 0 ? '2026-06-01' : null,
    amount:   i % 7  !== 0 ? 10000 + i * 100 : null,
    merchant: i % 13 !== 0 ? `테스트상호${i}` : null,
    description: `테스트 지출 ${i}`, category_id: null,
    status: 'created', evidence_status: i % 5 === 0 ? 'none' : 'uploaded',
    ai_confidence: 0.85, missing_fields: [], review_reason: null,
    tax_invoice_type: INVOICE_TYPES[i % INVOICE_TYPES.length],
    payment_method:   PAYMENT_METHODS[i % PAYMENT_METHODS.length],
    business_purpose: i % 3 === 0 ? null : `업무목적${i}`,
    vat_class: 'unknown', vat_reason: null,
    deductibility: 'unknown', tax_review_status: 'needs_review', tax_review_reason: null,
    ocr_quality: OCR_QUALITIES[i % OCR_QUALITIES.length],
    ocr_failure_mode: OCR_QUALITIES[i % OCR_QUALITIES.length] === 'failed' ? 'amount_missing' : null,
    tax_period: '2026-06', slack_ts: null,
  }));
}

export interface BenchmarkResult {
  totalSamples: number; syntheticSamples: number; iterations: number;
  readyCount: number; needsReviewCount: number; blockedCount: number;
  autoProcessRate: number; falseReadyCount: number; falseReadyRate: number;
  avgFindingsPerExpense: number; durationMs: number;
}

export async function runBenchmark(iterations = 12): Promise<BenchmarkResult> {
  const SYNTHETIC_COUNT = 720;
  let totalReady = 0, totalNeedsReview = 0, totalBlocked = 0;
  let totalFalseReady = 0, totalFindings = 0, totalSamples = 0;
  const start = Date.now();

  for (let iter = 0; iter < iterations; iter++) {
    for (const sample of generateSyntheticData(SYNTHETIC_COUNT)) {
      const cls = classify(sample);
      const enriched: TaxExpenseRow = { ...sample, vat_class: cls.vatClass, deductibility: cls.deductibility, tax_review_status: cls.taxReviewStatus, tax_review_reason: cls.taxReviewReason, vat_reason: cls.vatReason };
      if (cls.taxReviewStatus === 'ready') {
        (!sample.amount || !sample.date || !sample.merchant) ? totalFalseReady++ : totalReady++;
      } else if (cls.taxReviewStatus === 'needs_review') {
        totalNeedsReview++;
      } else {
        totalBlocked++;
      }
      totalFindings += generateFindings([enriched]).length;
      totalSamples++;
    }
  }

  const durationMs = Date.now() - start;
  return {
    totalSamples, syntheticSamples: SYNTHETIC_COUNT, iterations,
    readyCount: totalReady, needsReviewCount: totalNeedsReview, blockedCount: totalBlocked,
    autoProcessRate:       Math.round((totalReady / totalSamples) * 10000) / 100,
    falseReadyCount:       totalFalseReady,
    falseReadyRate:        Math.round((totalFalseReady / totalSamples) * 10000) / 100,
    avgFindingsPerExpense: Math.round((totalFindings / totalSamples) * 100) / 100,
    durationMs,
  };
}
