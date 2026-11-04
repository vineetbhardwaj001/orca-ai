import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App";

describe("ORCA dashboard", () => {
  it("renders the product identity and clearly labels future testing engines", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("ORCA");
    expect(html).toContain("Real-time QA");
    expect(html).toContain("deterministic virtual users");
    expect(html).toContain("Restoring your secure session");
  });
});
