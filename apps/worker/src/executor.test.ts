import { describe, expect, it } from "vitest";
import { executeEchoJob, validateClaimedJob } from "./executor.js";

const workerId = "f8a7e1b9-7146-4d8f-8d17-c9db2ffeb3af";
const job = {
  jobId: "45a32bf0-3c0c-4aa2-ae80-7bb9af4d1a11",
  jobType: "echo",
  organizationId: "fdf2c88d-4585-4d96-9dbe-3302696a8ad8",
  projectId: "72b2d068-2e8a-44dc-b7fb-4ebca6e3fd77",
  payload: { message: "hello from ORCA" },
  attempt: 1,
  lease: {
    id: "c943f4b2-66e9-4e42-b7c5-650d53b86e9e",
    token: "x".repeat(43),
    expiresAt: "2026-11-04T15:30:00.000Z",
  },
};

describe("bounded worker job execution", () => {
  it("executes only a schema-valid echo job and produces a stable result", () => {
    const result = executeEchoJob(job, workerId, new Date("2026-11-04T15:00:00.000Z"));
    expect(result).toEqual({
      echo: "hello from ORCA",
      workerId,
      processedAt: "2026-11-04T15:00:00.000Z",
    });
  });

  it("rejects unknown job types and malformed lease envelopes", () => {
    expect(() => validateClaimedJob({ ...job, jobType: "shell.exec" })).toThrow();
    expect(() => validateClaimedJob({ ...job, lease: { ...job.lease, token: "short" } })).toThrow();
  });

  it("rejects empty echo payloads and invalid worker identities", () => {
    expect(() => executeEchoJob({ ...job, payload: { message: "" } }, workerId)).toThrow();
    expect(() => executeEchoJob(job, "not-a-uuid")).toThrow();
  });
});
