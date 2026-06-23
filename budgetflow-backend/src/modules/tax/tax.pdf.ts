import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import type { TaxExpenseRow, TaxFinding } from './tax.types';

// 폰트 경로: 런타임 cwd(budgetflow-backend) 기준 + __dirname 폴백
function resolveFontPath(): string {
  const candidates = [
    path.join(process.cwd(), 'assets', 'fonts', 'NotoSansKR-Regular.otf'),
    path.join(__dirname, '..', '..', '..', 'assets', 'fonts', 'NotoSansKR-Regular.otf'),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? candidates[0];
}

// 색: 기본은 검정 계열만 사용. 강조 색은 '검토 필요(고위험)' 항목에만 빨강 사용.
const INK = '#000000';
const SUB = '#444444';
const LINE = '#D9D9D9';
const RED = '#CF1322';

const vatLabel: Record<string, string> = {
  vat_credit_candidate: '공제 후보',
  vat_non_credit_candidate: '불공제 검토',
  exempt_or_zero: '면세/영세',
  unknown: '미확인',
};
const evidenceLabel: Record<string, string> = {
  card_receipt: '카드영수증',
  cash_receipt: '현금영수증',
  tax_invoice: '세금계산서',
  simple_receipt: '간이영수증',
  unknown: '미확인',
};
const won = (n: number | null | undefined) =>
  n == null ? '-' : `${Number(n).toLocaleString('ko-KR')}원`;

function formatDateKo(d: unknown): string {
  const s = String(d ?? '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[1]}년 ${m[2]}월 ${m[3]}일` : s || '-';
}

/** 세무사 전달 패킷 PDF를 생성해 Buffer로 반환한다. */
export function buildAccountantPacketPdf(
  projectName: string,
  period: string,
  expenses: TaxExpenseRow[],
  findings: TaxFinding[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('kr', resolveFontPath());
    doc.font('kr');

    const ready = expenses.filter(e => e.tax_review_status === 'ready');
    const review = expenses.filter(e => e.tax_review_status === 'needs_review');
    const blocked = expenses.filter(e => e.tax_review_status === 'blocked');
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    const hr = () => {
      doc.moveDown(0.4);
      doc.strokeColor(LINE).lineWidth(1).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
      doc.moveDown(0.6);
    };
    const heading = (t: string) => {
      doc.moveDown(0.6);
      doc.fillColor(INK).fontSize(14).text(t, left, doc.y, { width });
      doc.moveDown(0.2);
      doc.fontSize(10);
    };
    const kvRow = (k: string, v: string) => {
      const y = doc.y;
      doc.fillColor(SUB).text(k, left, y, { width });
      doc.fillColor(INK).text(v, left, y, { width, align: 'right' });
    };

    // 헤더
    doc.fillColor(SUB).fontSize(11).text('BudgetFlow · 세무사 전달 자료', left, doc.y, { width });
    doc.fillColor(INK).fontSize(22).text('세무 신고 준비 패킷', left, doc.y, { width });
    doc.fillColor(SUB).fontSize(10);
    doc.text(`프로젝트: ${projectName}`, left, doc.y, { width });
    doc.text(`신고 기간: ${period}`, left, doc.y, { width });
    doc.text(`생성일: ${formatDateKo(new Date().toISOString())}`, left, doc.y, { width });
    hr();

    // 준비도 요약
    heading('준비도 요약');
    kvRow('자동 처리 가능 (준비 완료)', `${ready.length}건`);
    kvRow('검토 필요', `${review.length}건`);
    kvRow('신고 차단', `${blocked.length}건`);
    kvRow('전체', `${expenses.length}건`);

    // 검토 필요 항목 (고위험) — 이 섹션만 빨강 강조
    heading('검토 필요 항목 (High)');
    const high = findings.filter(f => f.severity === 'high');
    if (high.length === 0) {
      doc.fillColor(SUB).text('없음', left, doc.y, { width });
    } else {
      for (const f of high) {
        if (doc.y > doc.page.height - 90) doc.addPage().font('kr');
        doc.fillColor(RED).fontSize(10).text(`• ${f.merchant ?? '상호 미확인'} / ${won(f.amount)}`, left, doc.y, { width });
        doc.fillColor(RED).fontSize(9).text(`   ${f.reviewReason}`, left, doc.y, { width });
        doc.fontSize(10);
      }
    }

    // 준비 완료 지출 원장
    heading('지출 원장 (준비 완료)');
    const cols = [
      { t: '날짜', x: left, w: 96, align: 'left' as const },
      { t: '상호', x: left + 96, w: 120, align: 'left' as const },
      { t: '금액', x: left + 216, w: 74, align: 'right' as const },
      { t: '증빙', x: left + 300, w: 91, align: 'left' as const },
      { t: 'VAT', x: left + 391, w: width - 391, align: 'left' as const },
    ];
    const drawRow = (cells: string[], color: string, size = 9) => {
      const y = doc.y;
      doc.fontSize(size).fillColor(color);
      cols.forEach((c, i) => {
        doc.text(cells[i] ?? '', c.x, y, { width: c.w, align: c.align, lineBreak: false });
      });
      doc.x = left;
      doc.moveDown(0.9);
    };
    const headerRow = () => {
      drawRow(cols.map(c => c.t), SUB, 9);
      doc.strokeColor(LINE).lineWidth(0.5).moveTo(left, doc.y - 3).lineTo(right, doc.y - 3).stroke();
    };
    headerRow();
    if (ready.length === 0) {
      doc.fillColor(SUB).fontSize(9).text('준비 완료된 지출이 없습니다.', left, doc.y, { width });
    } else {
      for (const e of ready) {
        if (doc.y > doc.page.height - 70) {
          doc.addPage().font('kr');
          headerRow();
        }
        drawRow(
          [
            formatDateKo(e.date),
            e.merchant ?? '-',
            won(e.amount),
            evidenceLabel[e.tax_invoice_type ?? 'unknown'] ?? '미확인',
            vatLabel[e.vat_class ?? 'unknown'] ?? '미확인',
          ],
          INK,
          9,
        );
      }
    }

    // 면책 — 왼쪽 전체폭으로 정상 출력 (x를 명시해 표 마지막 컬럼 좌표를 물려받지 않도록)
    doc.x = left;
    doc.moveDown(1);
    hr();
    doc.fillColor(SUB).fontSize(8).text(
      '본 자료는 세무 신고 준비용 참고 자료입니다. VAT 공제 후보·손금 구분은 확정 판단이 아니며, ' +
        '최종 계정과목 확정·세무조정·신고 및 세법 판단의 책임은 세무사 또는 납세자 본인에게 있습니다.',
      left,
      doc.y,
      { width, align: 'left' },
    );

    doc.end();
  });
}
