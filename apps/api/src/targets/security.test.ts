import { describe, expect, it } from "vitest";
import {
  assertDnsOwnershipProof,
  assertPinnedDnsResolution,
  hashTargetVerificationRecord,
  isPathWithinTargetScope,
  isPubliclyRoutableAddress,
  normalizeTargetInput,
  resolvePublicAddresses,
  TargetSecurityError,
  type TargetDnsResolver,
} from "./security.js";

function resolver(
  addresses: string[],
  records: string[][] = [],
): TargetDnsResolver {
  return {
    lookup: async () => addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
    resolveTxt: async () => records,
  };
}

describe("target scope normalization", () => {
  it("canonicalizes a public DNS origin and explicit path scopes", () => {
    expect(normalizeTargetInput("https://EXAMPLE.com", ["/api", "/", "/api"])).toEqual({
      scheme: "https",
      hostname: "example.com",
      port: 443,
      pathPrefixes: ["/", "/api"],
    });
  });

  it.each([
    "ftp://example.com",
    "https://user:secret@example.com",
    "https://example.com/admin",
    "https://example.com?next=/",
    "https://example.com/#fragment",
    "https://example.com:8443",
    "http://localhost",
    "https://service.local",
    "https://service.internal",
    "https://service.test",
    "https://127.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://[::1]",
  ])("rejects unsafe or ambiguous target origin %s", (url) => {
    expect(() => normalizeTargetInput(url, ["/"])).toThrow(TargetSecurityError);
  });

  it.each(["/../admin", "/api/./v1", "/api//v1", "/api/%2fadmin", "/api\\admin", "/api?x=1", "/api#x", "/api;v=1"])(
    "rejects unsafe path prefix %s",
    (path) => {
      expect(() => normalizeTargetInput("https://example.com", [path])).toThrow(TargetSecurityError);
    },
  );

  it("does not treat a sibling path as inside a prefix", () => {
    expect(isPathWithinTargetScope("/api/v1/users", ["/api"])).toBe(true);
    expect(isPathWithinTargetScope("/api", ["/api"])).toBe(true);
    expect(isPathWithinTargetScope("/apiculture", ["/api"])).toBe(false);
    expect(isPathWithinTargetScope("/api/%2e%2e/private", ["/api"])).toBe(false);
    expect(isPathWithinTargetScope("/api//private", ["/api"])).toBe(false);
    expect(isPathWithinTargetScope("/api/../private", ["/api"])).toBe(false);
    expect(isPathWithinTargetScope("//api/private", ["/api"])).toBe(false);
  });
});

describe("SSRF address classification", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fc00::1",
    "2001:db8::1",
  ])("blocks non-public address %s", (address) => {
    expect(isPubliclyRoutableAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows globally routable address %s",
    (address) => {
      expect(isPubliclyRoutableAddress(address)).toBe(true);
    },
  );

  it("rejects a mixed public/private DNS answer set rather than choosing the public answer", async () => {
    await expect(resolvePublicAddresses("target.example.com", resolver(["8.8.8.8", "127.0.0.1"])))
      .rejects.toMatchObject({ code: "TARGET_DNS_NOT_PUBLIC", status: 422 });
  });

  it("rejects empty and oversized DNS answer sets", async () => {
    await expect(resolvePublicAddresses("target.example.com", resolver([])))
      .rejects.toMatchObject({ code: "TARGET_DNS_ANSWER_COUNT_INVALID" });
    const many = Array.from({ length: 33 }, (_value, index) => `8.8.${Math.floor(index / 250)}.${index + 1}`);
    await expect(resolvePublicAddresses("target.example.com", resolver(many)))
      .rejects.toMatchObject({ code: "TARGET_DNS_ANSWER_COUNT_INVALID" });
  });

  it("detects DNS rebinding or address-set changes after approval", async () => {
    await expect(assertPinnedDnsResolution("target.example.com", ["8.8.8.8"], resolver(["1.1.1.1"])))
      .rejects.toMatchObject({ code: "TARGET_DNS_CHANGED", status: 409 });
    await expect(assertPinnedDnsResolution("target.example.com", ["8.8.8.8"], resolver(["8.8.8.8"])))
      .resolves.toEqual(["8.8.8.8"]);
  });

  it("requires the exact DNS TXT proof and joins split TXT chunks", async () => {
    const value = "orca-verification=challenge-value";
    const fake = resolver(["8.8.8.8"], [["orca-verification=challenge-", "value"]]);
    await expect(assertDnsOwnershipProof("target.example.com", hashTargetVerificationRecord(value), fake)).resolves.toBeUndefined();
    await expect(assertDnsOwnershipProof("target.example.com", hashTargetVerificationRecord("different"), fake))
      .rejects.toMatchObject({ code: "TARGET_DNS_PROOF_MISSING" });
  });
});
