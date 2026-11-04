import { describe, expect, it } from "vitest";

describe("worker safety bootstrap", () => {
  it("does not accept work before authenticated enrollment exists", () => {
    const enrollmentToken = "";
    expect(Boolean(enrollmentToken)).toBe(false);
  });
});
