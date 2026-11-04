import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function readBearerToken(req: Request): string | null {
  const header = req.get("authorization");
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{40,128})$/.exec(header);
  return match?.[1] ?? null;
}

export function readLeaseToken(req: Request): string | null {
  const token = req.get("x-orca-lease-token");
  return token && /^[A-Za-z0-9_-]{40,128}$/.test(token) ? token : null;
}
