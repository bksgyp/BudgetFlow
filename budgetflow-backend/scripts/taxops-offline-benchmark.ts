import { runBenchmark } from '../src/modules/tax/tax.benchmark';

async function main() {
  console.log('BudgetFlow TaxOps Offline Benchmark 시작...\n');
  const result = await runBenchmark(12);

  console.log('=== 결과 ===');
  console.log(`총 검증 건수    : ${result.totalSamples.toLocaleString()}`);
  console.log(`반복 횟수       : ${result.iterations}회 (회차당 ${result.syntheticSamples}건)`);
  console.log(`자동 처리 가능  : ${result.readyCount.toLocaleString()}건 (${result.autoProcessRate}%)`);
  console.log(`검토 필요       : ${result.needsReviewCount.toLocaleString()}건`);
  console.log(`신고 차단       : ${result.blockedCount.toLocaleString()}건`);
  console.log(`false-ready     : ${result.falseReadyCount}건 (${result.falseReadyRate}%)`);
  console.log(`평균 findings/건: ${result.avgFindingsPerExpense}`);
  console.log(`소요 시간       : ${result.durationMs}ms`);

  if (result.falseReadyCount > 0) {
    console.error('\nfalse-ready 발생 - classifier 로직을 확인하세요.');
    process.exit(1);
  }
  console.log('\n벤치마크 통과');
}

main().catch(err => { console.error(err); process.exit(1); });
