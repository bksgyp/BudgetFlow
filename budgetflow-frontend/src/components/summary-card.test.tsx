import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SummaryCard } from "./summary-card";

describe("SummaryCard", () => {
  it("renders label, value, and the default tone", () => {
    const html = renderToStaticMarkup(
      <SummaryCard label="전체 지출" value="10건" />,
    );

    expect(html).toContain("전체 지출");
    expect(html).toContain("10건");
    expect(html).toContain("border-[var(--bf-border-subtle)]");
  });

  it("applies semantic tone classes", () => {
    expect(
      renderToStaticMarkup(
        <SummaryCard label="승인 금액" value="₩1" tone="success" />,
      ),
    ).toContain("border-l-[var(--bf-support-success)]");
    expect(
      renderToStaticMarkup(
        <SummaryCard label="검토 필요" value="1건" tone="warning" />,
      ),
    ).toContain("border-l-[var(--bf-support-warning)]");
    expect(
      renderToStaticMarkup(
        <SummaryCard label="증빙 누락" value="1건" tone="danger" />,
      ),
    ).toContain("border-l-[var(--bf-support-error)]");
  });
});
