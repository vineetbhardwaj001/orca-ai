import { z } from "zod";
import type { WorkerCredential } from "./credential-store.js";
const EchoJobResultSchema = z.object({
  echo: z.string().max(512),
  workerId: z.string().uuid(),
  processedAt: z.string().datetime(),
});
const WorkerJobClaimSchema = z.object({
  jobId: z.string().uuid(),
  jobType: z.literal("echo"),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  payload: z.object({ message: z.string().min(1).max(512) }),
  attempt: z.number().int().min(1).max(5),
  lease: z.object({
    id: z.string().uuid(),
    token: z.string().min(40).max(128),
    expiresAt: z.string().datetime(),
  }),
});
type WorkerJobClaim = z.infer<typeof WorkerJobClaimSchema>;
type EchoJobResult = z.infer<typeof EchoJobResultSchema>;

const envelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});

export class WorkerApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorkerApiError";
  }
}

async function request<T>(
  credential: WorkerCredential,
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", "Bearer " + credential.credential);
  if (init.body !== undefined) headers.set("content-type", "application/json");

  const response = await fetch(new URL("/api/v1" + path, credential.apiBaseUrl), {
    ...init,
    headers,
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new WorkerApiError("INVALID_RESPONSE", "The ORCA API returned an unreadable response.", response.status);
  }
  const envelope = envelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new WorkerApiError("INVALID_RESPONSE", "The ORCA API response did not match its envelope.", response.status);
  }
  if (!response.ok || !envelope.data.success) {
    throw new WorkerApiError(
      envelope.data.error?.code ?? "REQUEST_FAILED",
      envelope.data.error?.message ?? "The ORCA API request failed.",
      response.status,
    );
  }
  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success) {
    throw new WorkerApiError("INVALID_RESPONSE", "The ORCA API response did not match the expected schema.", response.status);
  }
  return parsed.data;
}

const claimResponseSchema = z.object({
  job: WorkerJobClaimSchema.nullable(),
  workerStatus: z.enum(["IDLE", "BUSY"]).optional(),
  retryAfterMs: z.number().int().min(100).max(30_000).optional(),
});
const heartbeatResponseSchema = z.object({
  workerId: z.string().uuid(),
  status: z.enum(["IDLE", "BUSY", "DEGRADED"]),
  lastHeartbeatAt: z.string(),
});
const completeResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal("succeeded"),
  result: EchoJobResultSchema,
});

export async function sendHeartbeat(
  credential: WorkerCredential,
  status: "IDLE" | "BUSY" | "DEGRADED",
  version: string,
): Promise<void> {
  await request(
    credential,
    "/workers/" + credential.workerId + "/heartbeat",
    heartbeatResponseSchema,
    { method: "POST", body: JSON.stringify({ status, version }) },
  );
}

export async function claimNextJob(credential: WorkerCredential): Promise<WorkerJobClaim | null> {
  const result = await request(
    credential,
    "/workers/" + credential.workerId + "/jobs/claim",
    claimResponseSchema,
    { method: "POST", body: "{}" },
  );
  return result.job;
}

export async function completeEchoJob(
  credential: WorkerCredential,
  job: WorkerJobClaim,
  result: EchoJobResult,
): Promise<void> {
  const headers = new Headers();
  headers.set("x-orca-lease-token", job.lease.token);
  await request(
    credential,
    "/workers/" + credential.workerId + "/jobs/" + job.jobId + "/complete",
    completeResponseSchema,
    { method: "POST", headers, body: JSON.stringify(result) },
  );
}
