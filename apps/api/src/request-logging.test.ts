import { describe, expect, it } from "vitest";
import { buildRequestLog } from "./request-logging.js";

describe("structured request logging", () => {
  it("emits only bounded request metadata and a stable request id", () => {
    const record = buildRequestLog({
      requestId: "req-12345678",
      method: "POST",
      path: "/api/v1/auth/login",
      statusCode: 401,
      durationMs: 12.345,
      timestamp: "2026-11-04T12:00:00.000Z",
    });

    expect(record).toEqual({
      timestamp: "2026-11-04T12:00:00.000Z",
      level: "info",
      requestId: "req-12345678",
      method: "POST",
      path: "/api/v1/auth/login",
      statusCode: 401,
      durationMs: 12.35,
    });
    expect(JSON.stringify(record)).not.toMatch(/password|cookie|authorization|token|secret/i);
  });

  it("marks server errors without recording request contents", () => {
    const record = buildRequestLog({
      requestId: "req-error",
      method: "GET",
      path: "/health",
      statusCode: 503,
      durationMs: 0,
    });

    expect(record.level).toBe("error");
    expect(Object.keys(record)).toEqual([
      "timestamp", "level", "requestId", "method", "path", "statusCode", "durationMs",
    ]);
  });
});
