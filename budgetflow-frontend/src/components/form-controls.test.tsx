import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SelectInput, TextArea, TextInput } from "./form-controls";

describe("form controls", () => {
  it("renders shared text input styling with custom props", () => {
    const html = renderToStaticMarkup(
      <TextInput name="email" autoComplete="email" />,
    );

    expect(html).toContain("name=\"email\"");
    expect(html).toContain("h-8");
    expect(html).toContain("focus-visible:border-ring");
  });

  it("renders textarea and select variants", () => {
    expect(renderToStaticMarkup(<TextArea name="memo" />)).toContain(
      "min-h-28",
    );
    expect(
      renderToStaticMarkup(
        <SelectInput name="category">
          <option value="snack">간식</option>
        </SelectInput>,
      ),
    ).toContain("간식");
  });
});
