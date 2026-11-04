import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("stores a salted scrypt hash and verifies the original password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});
