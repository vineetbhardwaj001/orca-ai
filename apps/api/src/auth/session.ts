import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { getPool } from "../db.js";

const COOKIE_NAME = "orca_session";
const SESSION_DAYS = 7;

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return undefined; }
  }
  return undefined;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export async function createSession(userId: string, res: Response): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt],
  );
  res.cookie(COOKIE_NAME, token, sessionCookieOptions());
}

export async function getSessionUser(req: Request): Promise<{ id: string; email: string; name: string } | null> {
  const token = readCookie(req, COOKIE_NAME);
  if (typeof token !== "string" || token.length < 32 || token.length > 128) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const result = await getPool().query<{ id: string; email: string; name: string }>(
    `SELECT u.id, u.email, u.name
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND s.revoked_at IS NULL
      LIMIT 1`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const token = readCookie(req, COOKIE_NAME);
  if (typeof token === "string" && token.length >= 32 && token.length <= 128) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await getPool().query(
      "UPDATE auth_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
      [tokenHash],
    );
  }
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
