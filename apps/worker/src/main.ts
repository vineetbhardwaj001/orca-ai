import dotenv from "dotenv";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { loadWorkerCredential, saveWorkerCredential, type WorkerCredential } from "./credential-store.js";
import { claimNextJob, completeEchoJob, sendHeartbeat, WorkerApiError } from "./client.js";
import { executeEchoJob } from "./executor.js";

dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const workerConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  enrollmentToken: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/).optional(),
  credentialFile: z.string().min(1),
  pollIntervalMs: z.coerce.number().int().min(250).max(30_000).default(2_000),
  heartbeatIntervalMs: z.coerce.number().int().min(1_000).max(60_000).default(15_000),
  version: z.string().min(1).max(40).default("0.5.0"),
  workerName: z.string().trim().min(2).max(80).default("orca-worker"),
});

function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = workerConfigSchema.safeParse({
    apiBaseUrl: environment.ORCA_API_BASE_URL ?? "http://127.0.0.1:4000",
    enrollmentToken: environment.ORCA_ENROLLMENT_TOKEN || undefined,
    credentialFile: environment.ORCA_WORKER_CREDENTIAL_FILE ?? join(homedir(), ".orca", "worker-credential.json"),
    pollIntervalMs: environment.WORKER_POLL_INTERVAL_MS ?? "2000",
    heartbeatIntervalMs: environment.WORKER_HEARTBEAT_INTERVAL_MS ?? "15000",
    version: environment.WORKER_VERSION ?? "0.5.0",
    workerName: environment.WORKER_NAME ?? "orca-worker",
  });
  if (!parsed.success) {
    throw new Error("Invalid worker configuration: " + parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; "));
  }
  const url = new URL(parsed.data.apiBaseUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("ORCA_API_BASE_URL must use HTTPS outside loopback development.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("ORCA_API_BASE_URL must not contain credentials, query parameters or a fragment.");
  }
  return { ...parsed.data, apiBaseUrl: url.origin };
}

const enrollmentResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    worker: z.object({ id: z.string().uuid(), credentialExpiresAt: z.string() }),
    credential: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/),
  }).optional(),
  error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional(),
});

async function enrollWorker(apiBaseUrl: string, enrollmentToken: string, workerName: string): Promise<WorkerCredential> {
  const response = await fetch(new URL("/api/v1/worker-enrollments/claim", apiBaseUrl), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ token: enrollmentToken, workerName }),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error("The ORCA API returned an unreadable enrollment response.");
  }
  const parsed = enrollmentResponseSchema.safeParse(raw);
  if (!parsed.success || !response.ok || !parsed.data.success || !parsed.data.data) {
    throw new Error(parsed.success ? parsed.data.error?.message ?? "Worker enrollment failed." : "The ORCA API enrollment response did not match its schema.");
  }
  const payload = parsed.data;
  return {
    apiBaseUrl,
    workerId: payload.data.worker.id,
    credential: payload.data.credential,
    createdAt: new Date().toISOString(),
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

export async function runWorker(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadConfig(environment);
  let credential: WorkerCredential;

  if (config.enrollmentToken) {
    credential = await enrollWorker(config.apiBaseUrl, config.enrollmentToken, config.workerName);
    await saveWorkerCredential(config.credentialFile, credential);
    console.log(JSON.stringify({
      level: "info",
      event: "worker_enrolled",
      workerId: credential.workerId,
      credentialFile: config.credentialFile,
    }));
  } else {
    credential = await loadWorkerCredential(config.credentialFile);
    if (credential.apiBaseUrl !== config.apiBaseUrl) {
      throw new Error("Stored worker credential is bound to a different API origin.");
    }
  }

  let stopping = false;
  let lastHeartbeatAt = 0;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  async function heartbeat(status: "IDLE" | "BUSY" | "DEGRADED") {
    await sendHeartbeat(credential, status, config.version);
    lastHeartbeatAt = Date.now();
  }

  console.log(JSON.stringify({
    level: "info",
    event: "worker_connected",
    workerId: credential.workerId,
    version: config.version,
  }));

  try {
    await heartbeat("IDLE");
    while (!stopping) {
      const job = await claimNextJob(credential);
      if (!job) {
        if (Date.now() - lastHeartbeatAt >= config.heartbeatIntervalMs) {
          await heartbeat("IDLE");
        }
        await sleep(config.pollIntervalMs);
        continue;
      }

      await heartbeat("BUSY");
      try {
        // v0.5 deliberately executes only this deterministic, bounded job type.
        const result = executeEchoJob(job, credential.workerId);
        await completeEchoJob(credential, job, result);
        console.log(JSON.stringify({
          level: "info",
          event: "worker_job_completed",
          workerId: credential.workerId,
          jobId: job.jobId,
          jobType: job.jobType,
          attempt: job.attempt,
        }));
      } catch (error) {
        const code = error instanceof WorkerApiError ? error.code : "JOB_EXECUTION_FAILED";
        console.error(JSON.stringify({
          level: "error",
          event: "worker_job_failed",
          workerId: credential.workerId,
          jobId: job.jobId,
          code,
        }));
        // Do not attempt an unsafe blind retry. The lease expires and the
        // control plane applies its bounded retry policy.
        throw error;
      }
      await heartbeat("IDLE");
    }
  } finally {
    if (!stopping) await heartbeat("DEGRADED").catch(() => undefined);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  runWorker().catch((error: unknown) => {
    const code = error instanceof WorkerApiError ? error.code : "WORKER_STARTUP_FAILED";
    console.error(JSON.stringify({ level: "error", event: "worker_stopped", code }));
    process.exitCode = 1;
  });
}
