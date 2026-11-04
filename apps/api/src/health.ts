export function getHealthPayload(now = new Date()) {
  return { success: true as const, data: { service: "orca-api", status: "healthy" as const, time: now.toISOString() } };
}
