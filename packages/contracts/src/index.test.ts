import { describe, expect, it } from "vitest";
import { TestOutcomeSchema, WorkerCapabilitySchema } from "./index.js";
describe("shared execution contracts", () => {
  it("accepts explicit terminal outcomes", () => {
    expect(TestOutcomeSchema.parse("PASS")).toBe("PASS");
    expect(TestOutcomeSchema.parse("NEEDS_REVIEW")).toBe("NEEDS_REVIEW");
  });
  it("rejects unknown worker capabilities", () => {
    expect(WorkerCapabilitySchema.safeParse("shell.unrestricted").success).toBe(false);
  });
});
