import { describe, expect, it } from "vitest";
import { ModelTaskSchema } from "./index.js";
describe("model gateway contracts", () => {
  it("allows only registered ORCA model task categories", () => {
    expect(ModelTaskSchema.parse("scenario_generation")).toBe("scenario_generation");
    expect(ModelTaskSchema.safeParse("unrestricted_shell").success).toBe(false);
  });
});
