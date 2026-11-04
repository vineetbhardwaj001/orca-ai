import { describe, expect, it } from "vitest";
import { createOpaqueToken, hashOpaqueToken } from "./security.js";

describe("worker credential primitives", () => {
  it("creates high-entropy URL-safe opaque tokens", () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("stores only a stable SHA-256 digest rather than the bearer token", () => {
    const token = createOpaqueToken();
    const digest = hashOpaqueToken(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(hashOpaqueToken(token));
    expect(digest).not.toContain(token);
  });
});
