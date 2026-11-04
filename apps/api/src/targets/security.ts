import { lookup, resolveTxt } from "node:dns/promises";
import { isIP } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import ipaddr from "ipaddr.js";

export type TargetDnsResolver = {
  lookup(hostname: string): Promise<Array<{ address: string; family: number }>>;
  resolveTxt(name: string): Promise<string[][]>;
};

export const systemTargetDnsResolver: TargetDnsResolver = {
  lookup: (hostname) => lookup(hostname, { all: true, verbatim: true }),
  resolveTxt: (name) => resolveTxt(name),
};

export class TargetSecurityError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "TargetSecurityError";
  }
}

export type NormalizedTarget = {
  scheme: "http" | "https";
  hostname: string;
  port: 80 | 443;
  pathPrefixes: string[];
};

const blockedHostSuffixes = [
  ".localhost", ".local", ".internal", ".home", ".lan",
  ".test", ".invalid", ".example", ".onion", ".arpa",
];
const MAX_DNS_ANSWERS = 32;
const DNS_TIMEOUT_MS = 5_000;

export function createTargetChallenge(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTargetVerificationRecord(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizePathPrefix(value: string): string {
  if (
    value.length === 0 ||
    value.length > 256 ||
    !value.startsWith("/") ||
    value.includes("//") ||
    /[%\\?#;\u0000-\u001f\u007f]/.test(value) ||
    !/^\/[A-Za-z0-9._~/-]*$/.test(value)
  ) {
    throw new TargetSecurityError("TARGET_PATH_SCOPE_INVALID", "A target path prefix is invalid.", 400);
  }

  const segments = value.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new TargetSecurityError("TARGET_PATH_SCOPE_INVALID", "Dot segments are not allowed in target path prefixes.", 400);
  }

  if (value === "/") return "/";
  return value.replace(/\/+$/, "");
}

export function normalizeTargetInput(baseUrl: string, pathPrefixes: string[]): NormalizedTarget {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new TargetSecurityError("TARGET_URL_INVALID", "Target URL must be a valid absolute HTTP(S) origin.", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TargetSecurityError("TARGET_SCHEME_FORBIDDEN", "Only HTTP and HTTPS target origins are supported.", 400);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new TargetSecurityError("TARGET_URL_NOT_ORIGIN", "Provide only the target origin; put allowed paths in pathPrefixes.", 400);
  }

  const scheme = parsed.protocol.slice(0, -1) as "http" | "https";
  const expectedPort = scheme === "https" ? 443 : 80;
  const port = parsed.port ? Number(parsed.port) : expectedPort;
  if (port !== expectedPort) {
    throw new TargetSecurityError("TARGET_PORT_FORBIDDEN", "Only the standard web port for the selected scheme is allowed in v0.6.", 400);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!hostname || hostname.length > 240 || isIP(hostname) !== 0 || ipaddr.isValid(hostname)) {
    throw new TargetSecurityError("TARGET_HOST_FORBIDDEN", "IP-literal targets are not allowed; use a verified public DNS hostname.", 400);
  }
  if (!hostname.includes(".")) {
    throw new TargetSecurityError("TARGET_HOST_FORBIDDEN", "Single-label and local hostnames are not allowed.", 400);
  }
  if (blockedHostSuffixes.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix))) {
    throw new TargetSecurityError("TARGET_HOST_FORBIDDEN", "Local, reserved and non-public DNS suffixes are not allowed.", 400);
  }

  const labels = hostname.split(".");
  if (labels.some((label) => label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    throw new TargetSecurityError("TARGET_HOST_INVALID", "Target hostname is not a valid canonical DNS name or is too long for the verification label.", 400);
  }

  if (!Array.isArray(pathPrefixes) || pathPrefixes.length < 1 || pathPrefixes.length > 50) {
    throw new TargetSecurityError("TARGET_PATH_SCOPE_INVALID", "Provide between one and fifty explicit path prefixes.", 400);
  }
  const normalizedPaths = [...new Set(pathPrefixes.map(normalizePathPrefix))].sort();
  return { scheme, hostname, port: port as 80 | 443, pathPrefixes: normalizedPaths };
}

export function isPubliclyRoutableAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    operation,
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new TargetSecurityError(
        "TARGET_DNS_TIMEOUT",
        "Target DNS verification timed out. Retry after checking the domain's DNS records.",
        503,
      )), timeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function assertDnsOwnershipProof(
  hostname: string,
  expectedRecordHash: string,
  resolver: TargetDnsResolver = systemTargetDnsResolver,
): Promise<void> {
  let records: string[][];
  try {
    records = await withTimeout(resolver.resolveTxt("_orca-verify." + hostname), DNS_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof TargetSecurityError) throw error;
    throw new TargetSecurityError("TARGET_DNS_TXT_LOOKUP_FAILED", "Could not read the target's DNS verification TXT record.", 503);
  }

  const matched = records.some((parts) => hashTargetVerificationRecord(parts.join("")) === expectedRecordHash);
  if (!matched) {
    throw new TargetSecurityError("TARGET_DNS_PROOF_MISSING", "The required ORCA DNS verification TXT record was not found.", 422);
  }
}

export async function resolvePublicAddresses(
  hostname: string,
  resolver: TargetDnsResolver = systemTargetDnsResolver,
): Promise<string[]> {
  let answers: Array<{ address: string; family: number }>;
  try {
    answers = await withTimeout(resolver.lookup(hostname), DNS_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof TargetSecurityError) throw error;
    throw new TargetSecurityError("TARGET_DNS_LOOKUP_FAILED", "The target hostname could not be resolved safely.", 503);
  }

  const addresses = [...new Set(answers.map((answer) => answer.address))].sort();
  if (addresses.length === 0 || addresses.length > MAX_DNS_ANSWERS) {
    throw new TargetSecurityError("TARGET_DNS_ANSWER_COUNT_INVALID", "Target DNS must resolve to between one and thirty-two addresses.", 422);
  }
  if (addresses.some((address) => !isPubliclyRoutableAddress(address))) {
    throw new TargetSecurityError("TARGET_DNS_NOT_PUBLIC", "Every A/AAAA answer must be globally routable; private, loopback, link-local and reserved addresses are blocked.", 422);
  }
  return addresses;
}

export async function assertPinnedDnsResolution(
  hostname: string,
  approvedAddresses: string[],
  resolver: TargetDnsResolver = systemTargetDnsResolver,
): Promise<string[]> {
  const currentAddresses = await resolvePublicAddresses(hostname, resolver);
  const approved = [...new Set(approvedAddresses)].sort();
  if (approved.length === 0 || currentAddresses.length !== approved.length ||
      currentAddresses.some((address, index) => address !== approved[index])) {
    throw new TargetSecurityError("TARGET_DNS_CHANGED", "Target DNS answers changed after approval; target execution must remain blocked until an administrator re-verifies it.", 409);
  }
  return currentAddresses;
}

export function isPathWithinTargetScope(pathname: string, pathPrefixes: string[]): boolean {
  if (!pathname.startsWith("/") || pathname.includes("\\") || pathname.includes("//") || /[%\\?#;\u0000-\u001f\u007f]/.test(pathname)) return false;
  if (pathname.split("/").some((segment) => segment === "." || segment === "..")) return false;
  return pathPrefixes.some((prefix) => {
    if (prefix === "/") return true;
    return pathname === prefix || pathname.startsWith(prefix + "/");
  });
}
