import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { getPool } from "../db.js";
import { getSessionUser } from "../auth/session.js";
import { createOpaqueToken, hashOpaqueToken, readBearerToken, readLeaseToken } from "./security.js";

const uuidSchema = z.string().uuid();
const WorkerCapabilitySchema = z.enum([
  "browser.playwright", "api.http", "performance.k6", "realtime.websocket",
  "discovery.website", "repository.inspect", "worker.echo",
]);
const EchoJobResultSchema = z.object({
  echo: z.string().max(512),
  workerId: uuidSchema,
  processedAt: z.string().datetime(),
});
const capabilitiesSchema = z.array(WorkerCapabilitySchema).min(1).max(20)
  .refine((items) => new Set(items).size === items.length, "Capabilities must be unique.");
const workerStatusSchema = z.enum(["IDLE", "BUSY", "DEGRADED"]);
const enrollmentSchema = z.object({ capabilities: capabilitiesSchema });
const claimEnrollmentSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/),
  workerName: z.string().trim().min(2).max(80),
});
const heartbeatSchema = z.object({
  status: workerStatusSchema,
  version: z.string().trim().min(1).max(40).optional(),
});
const echoJobSchema = z.object({
  projectId: uuidSchema,
  message: z.string().trim().min(1).max(512),
  idempotencyKey: z.string().min(16).max(200),
});

type WorkerRecord = {
  id: string;
  organization_id: string;
  name: string;
  capabilities: string[];
  credential_expires_at: Date;
};

function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

async function requireOrgAdmin(req: Request, res: Response, organizationId: string) {
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
    sendError(res, 403, "WORKER_ADMIN_FORBIDDEN", "An active organization owner or admin is required.");
    return null;
  }
  return user;
}

async function authenticateWorker(
  req: Request,
  res: Response,
  workerId: string,
  client?: PoolClient,
): Promise<WorkerRecord | null> {
  const token = readBearerToken(req);
  if (!token) {
    sendError(res, 401, "WORKER_CREDENTIAL_REQUIRED", "A valid worker bearer credential is required.");
    return null;
  }
  const queryable = client ?? getPool();
  const result = await queryable.query<WorkerRecord>(
    `SELECT id, organization_id, name, capabilities, credential_expires_at
       FROM workers
      WHERE id = $1 AND credential_hash = $2
        AND credential_expires_at > now() AND revoked_at IS NULL
      LIMIT 1${client ? " FOR UPDATE" : ""}`,
    [workerId, hashOpaqueToken(token)],
  );
  if (!result.rows[0]) {
    sendError(res, 401, "WORKER_CREDENTIAL_INVALID", "Worker credential is invalid, expired or revoked.");
    return null;
  }
  return result.rows[0];
}

export const workerAdminRouter = Router();

workerAdminRouter.post("/:organizationId/workers/enrollment-tokens", async (req, res, next) => {
  const organization = uuidSchema.safeParse(req.params.organizationId);
  const body = enrollmentSchema.safeParse(req.body);
  if (!organization.success || !body.success) {
    return sendError(res, 400, "VALIDATION_ERROR", "Organization ID or worker capabilities are invalid.");
  }
  try {
    const user = await requireOrgAdmin(req, res, organization.data);
    if (!user) return;
    const token = createOpaqueToken();
    const result = await getPool().query<{ id: string; expires_at: Date }>(
      `INSERT INTO worker_enrollment_tokens
        (organization_id, token_hash, capabilities, created_by, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '15 minutes')
       RETURNING id, expires_at`,
      [organization.data, hashOpaqueToken(token), body.data.capabilities, user.id],
    );
    return res.status(201).json({
      success: true,
      data: {
        enrollment: { id: result.rows[0]!.id, expiresAt: result.rows[0]!.expires_at },
        enrollmentToken: token,
        tokenWarning: "This token is shown once. Copy it to the intended worker and do not share it.",
      },
    });
  } catch (error) {
    return next(error);
  }
});

workerAdminRouter.post("/:organizationId/workers/enrollment-tokens/:tokenId/revoke", async (req, res, next) => {
  const organization = uuidSchema.safeParse(req.params.organizationId);
  const tokenId = uuidSchema.safeParse(req.params.tokenId);
  if (!organization.success || !tokenId.success) {
    return sendError(res, 400, "INVALID_RESOURCE_ID", "Organization or enrollment token ID is invalid.");
  }
  try {
    const user = await requireOrgAdmin(req, res, organization.data);
    if (!user) return;
    const revoked = await getPool().query(
      `UPDATE worker_enrollment_tokens
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE id = $1 AND organization_id = $2 AND used_at IS NULL
        RETURNING id`,
      [tokenId.data, organization.data],
    );
    if (!revoked.rowCount) {
      return sendError(res, 404, "ENROLLMENT_TOKEN_NOT_FOUND", "Unclaimed enrollment token was not found in this organization.");
    }
    return res.status(200).json({ success: true, data: { enrollmentTokenId: tokenId.data, revoked: true } });
  } catch (error) {
    return next(error);
  }
});

workerAdminRouter.get("/:organizationId/workers", async (req, res, next) => {
  const organization = uuidSchema.safeParse(req.params.organizationId);
  if (!organization.success) return sendError(res, 400, "INVALID_ORGANIZATION_ID", "Organization ID is invalid.");
  try {
    const user = await requireOrgAdmin(req, res, organization.data);
    if (!user) return;
    const result = await getPool().query(
      `SELECT id, name, capabilities, status, version, last_heartbeat_at,
              credential_expires_at, revoked_at, created_at
         FROM workers WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organization.data],
    );
    return res.status(200).json({ success: true, data: { workers: result.rows } });
  } catch (error) {
    return next(error);
  }
});

workerAdminRouter.post("/:organizationId/workers/:workerId/revoke", async (req, res, next) => {
  const organization = uuidSchema.safeParse(req.params.organizationId);
  const workerId = uuidSchema.safeParse(req.params.workerId);
  if (!organization.success || !workerId.success) {
    return sendError(res, 400, "INVALID_RESOURCE_ID", "Organization or worker ID is invalid.");
  }

  let client: PoolClient | undefined;
  try {
    const user = await requireOrgAdmin(req, res, organization.data);
    if (!user) return;
    client = await getPool().connect();
    await client.query("BEGIN");
    const revoked = await client.query(
      `UPDATE workers SET revoked_at = COALESCE(revoked_at, now()), status = 'DEGRADED'
        WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [workerId.data, organization.data],
    );
    if (!revoked.rowCount) {
      await client.query("ROLLBACK");
      return sendError(res, 404, "WORKER_NOT_FOUND", "Worker was not found in this organization.");
    }
    await client.query(
      "UPDATE worker_job_leases SET status = 'revoked' WHERE worker_id = $1 AND status = 'active'",
      [workerId.data],
    );
    await client.query(
      `UPDATE worker_jobs
          SET status = CASE WHEN attempt < max_attempts THEN 'queued' ELSE 'failed' END,
              assigned_worker_id = NULL, lease_token_hash = NULL, lease_expires_at = NULL,
              error_code = 'WORKER_REVOKED', updated_at = now()
        WHERE assigned_worker_id = $1 AND status = 'leased'`,
      [workerId.data],
    );
    await client.query("COMMIT");
    return res.status(200).json({ success: true, data: { workerId: workerId.data, revoked: true } });
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    return next(error);
  } finally {
    client?.release();
  }
});

workerAdminRouter.post("/:organizationId/jobs/echo", async (req, res, next) => {
  const organization = uuidSchema.safeParse(req.params.organizationId);
  const body = echoJobSchema.safeParse(req.body);
  if (!organization.success || !body.success) {
    return sendError(res, 400, "VALIDATION_ERROR", "Project, message or idempotency key is invalid.");
  }
  try {
    const user = await requireOrgAdmin(req, res, organization.data);
    if (!user) return;
    const result = await getPool().query(
      `INSERT INTO worker_jobs
        (organization_id, project_id, job_type, payload, required_capabilities, idempotency_key)
       SELECT $1, p.id, 'echo', $4::jsonb, ARRAY['worker.echo']::text[], $5
         FROM projects p
        WHERE p.id = $2 AND p.organization_id = $1 AND p.status = 'active'
          AND EXISTS (
            SELECT 1 FROM organization_members m
             WHERE m.organization_id = $1 AND m.user_id = $3
               AND m.status = 'active' AND m.role IN ('owner', 'admin')
          )
       RETURNING id, organization_id, project_id, job_type, status, required_capabilities, created_at`,
      [organization.data, body.data.projectId, user.id, JSON.stringify({ message: body.data.message }), body.data.idempotencyKey],
    );
    if (!result.rows[0]) {
      return sendError(res, 404, "PROJECT_NOT_FOUND_OR_FORBIDDEN", "Active project was not found or job creation is not permitted.");
    }
    return res.status(202).json({ success: true, data: { job: result.rows[0] } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return sendError(res, 409, "IDEMPOTENCY_KEY_REUSED", "This idempotency key has already been used in the organization.");
    }
    return next(error);
  }
});

export const workerEnrollmentRouter = Router();

workerEnrollmentRouter.post("/claim", async (req, res, next) => {
  const body = claimEnrollmentSchema.safeParse(req.body);
  if (!body.success) return sendError(res, 400, "VALIDATION_ERROR", "Enrollment token or worker name is invalid.");

  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    const enrollment = await client.query<{ id: string; organization_id: string; capabilities: string[] }>(
      `SELECT id, organization_id, capabilities
         FROM worker_enrollment_tokens
        WHERE token_hash = $1 AND expires_at > now()
          AND used_at IS NULL AND revoked_at IS NULL
        FOR UPDATE`,
      [hashOpaqueToken(body.data.token)],
    );
    if (!enrollment.rows[0]) {
      await client.query("ROLLBACK");
      return sendError(res, 401, "ENROLLMENT_TOKEN_INVALID", "Enrollment token is invalid, expired, revoked or already used.");
    }

    const credential = createOpaqueToken();
    const worker = await client.query<{ id: string; credential_expires_at: Date }>(
      `INSERT INTO workers
        (organization_id, name, capabilities, credential_hash, credential_expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '30 days')
       RETURNING id, credential_expires_at`,
      [enrollment.rows[0]!.organization_id, body.data.workerName, enrollment.rows[0]!.capabilities, hashOpaqueToken(credential)],
    );
    await client.query(
      "UPDATE worker_enrollment_tokens SET used_at = now() WHERE id = $1",
      [enrollment.rows[0]!.id],
    );
    await client.query("COMMIT");
    return res.status(201).json({
      success: true,
      data: {
        worker: {
          id: worker.rows[0]!.id,
          organizationId: enrollment.rows[0]!.organization_id,
          name: body.data.workerName,
          capabilities: enrollment.rows[0]!.capabilities,
          credentialExpiresAt: worker.rows[0]!.credential_expires_at,
        },
        credential,
        credentialWarning: "This worker credential is shown once. Store it in the worker's protected local credential file.",
      },
    });
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    return next(error);
  } finally {
    client?.release();
  }
});

export const workerProtocolRouter = Router();

workerProtocolRouter.post("/:workerId/heartbeat", async (req, res, next) => {
  const workerId = uuidSchema.safeParse(req.params.workerId);
  const body = heartbeatSchema.safeParse(req.body);
  if (!workerId.success || !body.success) return sendError(res, 400, "VALIDATION_ERROR", "Worker ID or heartbeat is invalid.");
  try {
    const token = readBearerToken(req);
    const worker = await authenticateWorker(req, res, workerId.data);
    if (!worker || !token) return;
    const result = await getPool().query(
      `UPDATE workers SET status = $3, version = COALESCE($4, version),
              last_heartbeat_at = now()
        WHERE id = $1 AND credential_hash = $2 AND revoked_at IS NULL
          AND credential_expires_at > now()
       RETURNING id, status, last_heartbeat_at`,
      [worker.id, hashOpaqueToken(token), body.data.status, body.data.version ?? null],
    );
    if (!result.rows[0]) return sendError(res, 401, "WORKER_CREDENTIAL_INVALID", "Worker credential is no longer active.");
    return res.status(200).json({
      success: true,
      data: { workerId: worker.id, status: result.rows[0].status, lastHeartbeatAt: result.rows[0].last_heartbeat_at },
    });
  } catch (error) {
    return next(error);
  }
});

workerProtocolRouter.post("/:workerId/jobs/claim", async (req, res, next) => {
  const workerId = uuidSchema.safeParse(req.params.workerId);
  if (!workerId.success) return sendError(res, 400, "INVALID_WORKER_ID", "Worker ID is invalid.");
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    const worker = await authenticateWorker(req, res, workerId.data, client);
    if (!worker) {
      await client.query("ROLLBACK");
      return;
    }

    await client.query(
      "UPDATE worker_job_leases SET status = 'expired' WHERE status = 'active' AND expires_at <= now() AND worker_id IN (SELECT id FROM workers WHERE organization_id = $1)",
      [worker.organization_id],
    );
    await client.query(
      `UPDATE worker_jobs
          SET status = CASE WHEN attempt >= max_attempts THEN 'failed' ELSE 'queued' END,
              assigned_worker_id = NULL, lease_token_hash = NULL, lease_expires_at = NULL,
              error_code = CASE WHEN attempt >= max_attempts THEN 'LEASE_ATTEMPTS_EXHAUSTED' ELSE NULL END,
              updated_at = now()
        WHERE organization_id = $1 AND status = 'leased' AND lease_expires_at <= now()`,
      [worker.organization_id],
    );

    const alreadyBusy = await client.query(
      "SELECT 1 FROM worker_jobs WHERE assigned_worker_id = $1 AND status = 'leased' AND lease_expires_at > now() LIMIT 1",
      [worker.id],
    );
    if (alreadyBusy.rowCount) {
      await client.query("COMMIT");
      return res.status(200).json({ success: true, data: { job: null, workerStatus: "BUSY" } });
    }

    const queued = await client.query<{
      id: string; organization_id: string; project_id: string; job_type: string;
      payload: { message: string }; attempt: number; max_attempts: number;
    }>(
      `SELECT j.id, j.organization_id, j.project_id, j.job_type, j.payload, j.attempt, j.max_attempts
         FROM worker_jobs j
         JOIN projects p ON p.id = j.project_id AND p.organization_id = j.organization_id
        WHERE j.organization_id = $1 AND j.status = 'queued'
          AND j.required_capabilities <@ $2::text[] AND p.status = 'active'
        ORDER BY j.created_at ASC
        LIMIT 1
        FOR UPDATE OF j SKIP LOCKED`,
      [worker.organization_id, worker.capabilities],
    );

    if (!queued.rows[0]) {
      await client.query("UPDATE workers SET status = 'IDLE', last_heartbeat_at = now() WHERE id = $1", [worker.id]);
      await client.query("COMMIT");
      return res.status(200).json({ success: true, data: { job: null, workerStatus: "IDLE", retryAfterMs: 2000 } });
    }

    const leaseToken = createOpaqueToken();
    const leaseHash = hashOpaqueToken(leaseToken);
    const leaseDurationSeconds = 60;
    const updated = await client.query<{ attempt: number; lease_expires_at: Date }>(
      `UPDATE worker_jobs
          SET status = 'leased', assigned_worker_id = $2, lease_token_hash = $3,
              lease_expires_at = now() + ($4::text || ' seconds')::interval,
              attempt = attempt + 1, updated_at = now()
        WHERE id = $1
       RETURNING attempt, lease_expires_at`,
      [queued.rows[0]!.id, worker.id, leaseHash, leaseDurationSeconds],
    );
    const lease = await client.query<{ id: string }>(
      `INSERT INTO worker_job_leases
        (organization_id, job_id, worker_id, lease_token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [worker.organization_id, queued.rows[0]!.id, worker.id, leaseHash, updated.rows[0]!.lease_expires_at],
    );
    await client.query("UPDATE workers SET status = 'BUSY', last_heartbeat_at = now() WHERE id = $1", [worker.id]);
    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      data: {
        workerStatus: "BUSY",
        job: {
          jobId: queued.rows[0]!.id,
          jobType: "echo",
          organizationId: queued.rows[0]!.organization_id,
          projectId: queued.rows[0]!.project_id,
          payload: queued.rows[0]!.payload,
          attempt: updated.rows[0]!.attempt,
          lease: { id: lease.rows[0]!.id, token: leaseToken, expiresAt: updated.rows[0]!.lease_expires_at },
        },
      },
    });
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    return next(error);
  } finally {
    client?.release();
  }
});

workerProtocolRouter.post("/:workerId/jobs/:jobId/complete", async (req, res, next) => {
  const workerId = uuidSchema.safeParse(req.params.workerId);
  const jobId = uuidSchema.safeParse(req.params.jobId);
  const leaseToken = readLeaseToken(req);
  const body = EchoJobResultSchema.safeParse(req.body);
  if (!workerId.success || !jobId.success || !leaseToken || !body.success) {
    return sendError(res, 400, "VALIDATION_ERROR", "Worker, job, lease token or result is invalid.");
  }

  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    const worker = await authenticateWorker(req, res, workerId.data, client);
    if (!worker) {
      await client.query("ROLLBACK");
      return;
    }
    if (body.data.workerId !== worker.id) {
      await client.query("ROLLBACK");
      return sendError(res, 403, "RESULT_WORKER_MISMATCH", "Result worker identity does not match the authenticated worker.");
    }

    const digest = hashOpaqueToken(leaseToken);
    const current = await client.query<{ payload: { message: string } }>(
      `SELECT payload FROM worker_jobs
        WHERE id = $1 AND organization_id = $2 AND assigned_worker_id = $3
          AND status = 'leased' AND lease_token_hash = $4 AND lease_expires_at > now()
        FOR UPDATE`,
      [jobId.data, worker.organization_id, worker.id, digest],
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return sendError(res, 409, "LEASE_INVALID_OR_EXPIRED", "Job lease is invalid, expired, revoked or no longer owned by this worker.");
    }
    if (current.rows[0].payload.message !== body.data.echo) {
      await client.query("ROLLBACK");
      return sendError(res, 422, "ECHO_RESULT_MISMATCH", "The result did not match the persisted echo-job input.");
    }

    await client.query(
      `UPDATE worker_jobs
          SET status = 'succeeded', result = $2::jsonb,
              assigned_worker_id = NULL, lease_token_hash = NULL, lease_expires_at = NULL,
              completed_at = now(), updated_at = now(), error_code = NULL
        WHERE id = $1`,
      [jobId.data, JSON.stringify(body.data)],
    );
    await client.query(
      "UPDATE worker_job_leases SET status = 'completed', completed_at = now() WHERE lease_token_hash = $1 AND status = 'active'",
      [digest],
    );
    await client.query("UPDATE workers SET status = 'IDLE', last_heartbeat_at = now() WHERE id = $1", [worker.id]);
    await client.query("COMMIT");
    return res.status(200).json({ success: true, data: { jobId: jobId.data, status: "succeeded", result: body.data } });
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    return next(error);
  } finally {
    client?.release();
  }
});
