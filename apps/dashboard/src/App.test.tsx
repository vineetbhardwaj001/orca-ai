import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App";
describe("ORCA dashboard", () => {
  it("renders the product identity and V1 testing capabilities", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("ORCA");
    expect(html).toContain("Real-time QA");
    expect(html).toContain("100 synthetic virtual users");
  });
});
