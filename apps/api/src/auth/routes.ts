import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession, getSessionUser, revokeSession } from "./session.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  organizationName: z.string().trim().min(2).max(100),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

authRouter.post("/register", async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Please check the submitted fields." } });
  const input = parsed.data;
  const email = input.email.toLowerCase();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const passwordHash = await hashPassword(input.password);
    const user = await client.query<{ id: string }>(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [input.name, email, passwordHash],
    );
    const slug = `${input.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${randomUUID().slice(0, 8)}`;
    const organization = await client.query<{ id: string }>(
      "INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id",
      [input.organizationName, slug],
    );
    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')",
      [organization.rows[0]!.id, user.rows[0]!.id],
    );
    await client.query("COMMIT");
    await createSession(user.rows[0]!.id, res);
    return res.status(201).json({
      success: true,
      data: { user: { id: user.rows[0]!.id, name: input.name, email }, organizationId: organization.rows[0]!.id },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return res.status(409).json({ success: false, error: { code: "EMAIL_IN_USE", message: "An account with this email already exists." } });
    }
    return next(error);
  } finally {
    client.release();
  }
});

authRouter.post("/login", async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Email or password is invalid." } });
  try {
    const result = await getPool().query<{ id: string; name: string; email: string; password_hash: string }>(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1 LIMIT 1",
      [parsed.data.email.toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } });
    }
    await createSession(user.id, res);
    return res.status(200).json({ success: true, data: { user: { id: user.id, name: user.name, email: user.email } } });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    await revokeSession(req, res);
    return res.status(200).json({ success: true, data: { loggedOut: true } });
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } });
    const memberships = await getPool().query<{ organization_id: string; organization_name: string; role: string }>(
      `SELECT m.organization_id, o.name AS organization_name, m.role
         FROM organization_members m
         JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = $1 AND m.status = 'active'
        ORDER BY m.created_at ASC`,
      [user.id],
    );
    return res.status(200).json({ success: true, data: { user, organizations: memberships.rows } });
  } catch (error) {
    return next(error);
  }
});
