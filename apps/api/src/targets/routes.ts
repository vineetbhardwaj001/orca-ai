import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { getPool } from "../db.js";
import { getSessionUser } from "../auth/session.js";
import {
  assertDnsOwnershipProof,
  createTargetChallenge,
  hashTargetVerificationRecord,
  normalizeTargetInput,
  resolvePublicAddresses,
  TargetSecurityError,
  systemTargetDnsResolver,
  type TargetDnsResolver,
} from "./security.js";

const uuidSchema = z.string().uuid();
const createTargetSchema = z.object({
  projectId: uuidSchema,
  baseUrl: z.string().trim().min(8).max(2048),
  pathPrefixes: z.array(z.string().min(1).max(256)).min(1).max(50),
  authorizationConfirmed: z.literal(true),
  authorizationExpiresAt: z.string().datetime({ offset: true }),
}).strict();

const rateLimitMessage = {
  success: false,
  error: { code: "RATE_LIMITED", message: "Too many target-management requests. Please retry later." },
};

const targetCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  identifier: "target-create",
  message: rateLimitMessage,
});
const targetListLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  identifier: "target-list",
  message: rateLimitMessage,
});
const targetVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  identifier: "target-verify",
  message: rateLimitMessage,
});
const targetRevokeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  identifier: "target-revoke",
  message: rateLimitMessage,
});

type AuthorizedTargetRecord = {
  id: string;
  organization_id: string;
  project_id: string;
  scheme: "http" | "https";
  hostname: string;
  port: number;
  path_prefixes: string[];
  authorization_expires_at: Date;
  verification_token_hash: string;
  status: "pending_verification" | "active" | "revoked";
  dns_verified_at: Date | null;
  verification_expires_at: Date | null;
  resolved_addresses: string[];
  revoked_at: Date | null;
  created_at: Date;
};

function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

async function requireOrganizationAdmin(req: Request, res: Response, organizationId: string) {
  const user = await getSessionUser(req);
  if (!user) {
    sendError(res, 401, "UNAUTHENTICATED", "Please sign in to continue.");
    return null;
  }
  const membership = await getPool().query(
    `SELECT 1 FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
        AND role IN ('owner', 'admin') LIMIT 1`,
    [organizationId, user.id],
  );
  if (!membership.rowCount) {
    sendError(res, 403, "TARGET_ADMIN_FORBIDDEN", "An active organization owner or admin is required to manage targets.");
    return null;
  }
  return user;
}

function sendTargetSecurityError(res: Response, error: TargetSecurityError) {
  return sendError(res, error.status, error.code, error.message);
}

export function createTargetRouter(resolver: TargetDnsResolver = systemTargetDnsResolver) {
  const router = Router();

  router.post("/:organizationId/targets", targetCreateLimiter, async (req, res, next) => {
    const organization = uuidSchema.safeParse(req.params.organizationId);
    const body = createTargetSchema.safeParse(req.body);
    if (!organization.success || !body.success) {
      return sendError(res, 400, "VALIDATION_ERROR", "Organization ID or target authorization details are invalid.");
    }

    let normalized;
    try {
      normalized = normalizeTargetInput(body.data.baseUrl, body.data.pathPrefixes);
    } catch (error) {
      if (error instanceof TargetSecurityError) return sendTargetSecurityError(res, error);
      return next(error);
    }

    const authorizationExpiresAt = new Date(body.data.authorizationExpiresAt);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const ninetyDays = 90 * 24 * oneHour;
    if (!Number.isFinite(authorizationExpiresAt.getTime()) ||
        authorizationExpiresAt.getTime() < now + oneHour ||
        authorizationExpiresAt.getTime() > now + ninetyDays) {
      return sendError(res, 400, "AUTHORIZATION_EXPIRY_INVALID", "Authorization expiry must be between one hour and ninety days from now.");
    }

    try {
      const user = await requireOrganizationAdmin(req, res, organization.data);
      if (!user) return;

      const challenge = createTargetChallenge();
      const recordValue = "orca-verification=" + challenge;
      const inserted = await getPool().query<AuthorizedTargetRecord>(
        `INSERT INTO authorized_targets
          (organization_id, project_id, scheme, hostname, port, path_prefixes,
           authorization_confirmed_by, authorization_confirmed_at, authorization_expires_at,
           verification_token_hash, created_by)
         SELECT $1, p.id, $4, $5, $6, $7, $3, now(), $8, $9, $3
           FROM projects p
          WHERE p.id = $2 AND p.organization_id = $1 AND p.status = 'active'
            AND EXISTS (
              SELECT 1 FROM organization_members m
               WHERE m.organization_id = $1 AND m.user_id = $3
                 AND m.status = 'active' AND m.role IN ('owner', 'admin')
            )
         RETURNING id, organization_id, project_id, scheme, hostname, port, path_prefixes,
                   authorization_expires_at, status, dns_verified_at, verification_expires_at,
                   resolved_addresses, revoked_at, created_at`,
        [
          organization.data,
          body.data.projectId,
          user.id,
          normalized.scheme,
          normalized.hostname,
          normalized.port,
          normalized.pathPrefixes,
          authorizationExpiresAt,
          hashTargetVerificationRecord(recordValue),
        ],
      );

      if (!inserted.rows[0]) {
        return sendError(res, 404, "PROJECT_NOT_FOUND_OR_FORBIDDEN", "An active project in this organization was not found or target creation is not permitted.");
      }

      return res.status(201).json({
        success: true,
        data: {
          target: inserted.rows[0],
          dnsVerification: {
            recordName: "_orca-verify." + normalized.hostname,
            recordType: "TXT",
            recordValue,
            warning: "This proof is shown once. Publish it in the target domain's DNS. Do not share it with other organizations.",
          },
          executionEnabled: false,
        },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return sendError(res, 409, "TARGET_ALREADY_REGISTERED", "This target origin is already registered for the selected project.");
      }
      return next(error);
    }
  });

  router.get("/:organizationId/targets", targetListLimiter, async (req, res, next) => {
    const organization = uuidSchema.safeParse(req.params.organizationId);
    if (!organization.success) return sendError(res, 400, "INVALID_ORGANIZATION_ID", "Organization ID is invalid.");
    try {
      const user = await requireOrganizationAdmin(req, res, organization.data);
      if (!user) return;
      const result = await getPool().query(
        `SELECT id, organization_id, project_id, scheme, hostname, port, path_prefixes,
                authorization_confirmed_at, authorization_expires_at, status, dns_verified_at,
                verification_expires_at, resolved_addresses, revoked_at, created_at
           FROM authorized_targets
          WHERE organization_id = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [organization.data],
      );
      return res.status(200).json({ success: true, data: { targets: result.rows, executionEnabled: false } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:organizationId/targets/:targetId/verify", targetVerifyLimiter, async (req, res, next) => {
    const organization = uuidSchema.safeParse(req.params.organizationId);
    const targetId = uuidSchema.safeParse(req.params.targetId);
    if (!organization.success || !targetId.success) {
      return sendError(res, 400, "INVALID_RESOURCE_ID", "Organization or target ID is invalid.");
    }

    try {
      const user = await requireOrganizationAdmin(req, res, organization.data);
      if (!user) return;

      const selected = await getPool().query<AuthorizedTargetRecord>(
        `SELECT id, organization_id, project_id, scheme, hostname, port, path_prefixes,
                authorization_expires_at, verification_token_hash, status, dns_verified_at,
                verification_expires_at, resolved_addresses, revoked_at, created_at
           FROM authorized_targets
          WHERE id = $1 AND organization_id = $2
          LIMIT 1`,
        [targetId.data, organization.data],
      );
      const target = selected.rows[0];
      if (!target) return sendError(res, 404, "TARGET_NOT_FOUND", "Target was not found in this organization.");
      if (target.status === "revoked" || target.revoked_at) {
        return sendError(res, 409, "TARGET_REVOKED", "A revoked target cannot be verified.");
      }
      if (target.status !== "pending_verification") {
        return sendError(res, 409, "TARGET_NOT_PENDING", "Target is not waiting for DNS verification.");
      }
      if (new Date(target.authorization_expires_at).getTime() <= Date.now()) {
        return sendError(res, 409, "TARGET_AUTHORIZATION_EXPIRED", "The target authorization window has expired. Register it again with current authorization.");
      }

      try {
        await assertDnsOwnershipProof(target.hostname, target.verification_token_hash, resolver);
        const addresses = await resolvePublicAddresses(target.hostname, resolver);
        const updated = await getPool().query(
          `UPDATE authorized_targets
              SET status = 'active', dns_verified_at = now(),
                  verification_expires_at = now() + interval '24 hours',
                  resolved_addresses = $3::jsonb, updated_at = now()
            WHERE id = $1 AND organization_id = $2
              AND status = 'pending_verification' AND revoked_at IS NULL
              AND authorization_expires_at > now()
           RETURNING id, organization_id, project_id, scheme, hostname, port, path_prefixes,
                     authorization_expires_at, status, dns_verified_at, verification_expires_at,
                     resolved_addresses, revoked_at, created_at`,
          [targetId.data, organization.data, JSON.stringify(addresses)],
        );
        if (!updated.rows[0]) {
          return sendError(res, 409, "TARGET_STATE_CHANGED", "Target authorization changed while DNS verification was running.");
        }
        return res.status(200).json({ success: true, data: { target: updated.rows[0], executionEnabled: false } });
      } catch (error) {
        if (error instanceof TargetSecurityError) return sendTargetSecurityError(res, error);
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:organizationId/targets/:targetId/revoke", targetRevokeLimiter, async (req, res, next) => {
    const organization = uuidSchema.safeParse(req.params.organizationId);
    const targetId = uuidSchema.safeParse(req.params.targetId);
    if (!organization.success || !targetId.success) {
      return sendError(res, 400, "INVALID_RESOURCE_ID", "Organization or target ID is invalid.");
    }
    try {
      const user = await requireOrganizationAdmin(req, res, organization.data);
      if (!user) return;
      const revoked = await getPool().query(
        `UPDATE authorized_targets
            SET status = 'revoked', revoked_at = COALESCE(revoked_at, now()), updated_at = now()
          WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
          RETURNING id`,
        [targetId.data, organization.data],
      );
      if (!revoked.rows[0]) return sendError(res, 404, "TARGET_NOT_FOUND", "Active or pending target was not found in this organization.");
      return res.status(200).json({ success: true, data: { targetId: targetId.data, revoked: true } });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
