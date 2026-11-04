import { z } from "zod";

export const TestOutcomeSchema = z.enum(["PASS", "FAIL", "BLOCKED", "SKIPPED", "NOT_RUN", "NEEDS_REVIEW"]);
export type TestOutcome = z.infer<typeof TestOutcomeSchema>;

export const WorkerCapabilitySchema = z.enum([
  "browser.playwright",
  "api.http",
  "performance.k6",
  "realtime.websocket",
  "discovery.website",
  "repository.inspect",
  "worker.echo",
]);
export type WorkerCapability = z.infer<typeof WorkerCapabilitySchema>;

export const ExecutionModeSchema = z.enum(["deterministic", "autonomous", "both"]);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const WorkerHeartbeatSchema = z.object({
  workerId: z.string().uuid(),
  sentAt: z.string().datetime(),
  status: z.enum(["IDLE", "BUSY", "DEGRADED"]),
  version: z.string().min(1).max(40).optional(),
});
export type WorkerHeartbeat = z.infer<typeof WorkerHeartbeatSchema>;

export const EchoJobPayloadSchema = z.object({
  message: z.string().min(1).max(512),
});
export type EchoJobPayload = z.infer<typeof EchoJobPayloadSchema>;

export const EchoJobResultSchema = z.object({
  echo: z.string().max(512),
  workerId: z.string().uuid(),
  processedAt: z.string().datetime(),
});
export type EchoJobResult = z.infer<typeof EchoJobResultSchema>;

export const WorkerJobClaimSchema = z.object({
  jobId: z.string().uuid(),
  jobType: z.literal("echo"),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  payload: EchoJobPayloadSchema,
  attempt: z.number().int().min(1).max(5),
  lease: z.object({
    id: z.string().uuid(),
    token: z.string().min(40).max(128),
    expiresAt: z.string().datetime(),
  }),
});
export type WorkerJobClaim = z.infer<typeof WorkerJobClaimSchema>;

export const JobEnvelopeSchema = z.object({
  jobId: z.string().uuid(),
  runId: z.string().uuid(),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  targetId: z.string().uuid(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  idempotencyKey: z.string().min(16).max(200),
  requiredCapabilities: z.array(WorkerCapabilitySchema).min(1),
  executionLimits: z.object({
    timeoutSeconds: z.number().int().positive().max(3600),
    memoryMb: z.number().int().positive().max(8192),
    maxProcesses: z.number().int().positive().max(128),
  }),
  approvedTargetScope: z.object({
    scheme: z.enum(["http", "https"]),
    hostname: z.string().min(1),
    ports: z.array(z.number().int().min(1).max(65535)).min(1),
    pathPrefixes: z.array(z.string()).min(1),
  }),
});
export type JobEnvelope = z.infer<typeof JobEnvelopeSchema>;
