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
const EchoJobPayloadSchema = z.object({ message: z.string().min(1).max(512) });
const EchoJobResultSchema = z.object({
  echo: z.string().max(512),
  workerId: z.string().uuid(),
  processedAt: z.string().datetime(),
});
type EchoJobResult = z.infer<typeof EchoJobResultSchema>;
type WorkerJobClaim = z.infer<typeof WorkerJobClaimSchema>;

export function executeEchoJob(input: unknown, workerId: string, now = new Date()): EchoJobResult {
  const job = WorkerJobClaimSchema.parse(input);
  const payload = EchoJobPayloadSchema.parse(job.payload);
  const result = EchoJobResultSchema.parse({
    echo: payload.message,
    workerId,
    processedAt: now.toISOString(),
  });
  return result;
}

export function validateClaimedJob(input: unknown): WorkerJobClaim {
  return WorkerJobClaimSchema.parse(input);
}
