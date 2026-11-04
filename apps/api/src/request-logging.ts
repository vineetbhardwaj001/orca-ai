import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";

type RequestLogInput = {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp?: string;
};

export function buildRequestLog(input: RequestLogInput) {
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: input.statusCode >= 500 ? "error" : "info",
    requestId: input.requestId,
    method: input.method,
    path: input.path,
    statusCode: input.statusCode,
    durationMs: Math.max(0, Number(input.durationMs.toFixed(2))),
  };
}

export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: Parameters<RequestHandler>[2],
): void {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const record = buildRequestLog({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
    // Deliberately log metadata only. Do not add request bodies, query strings,
    // cookies, authorization headers, passwords, tokens or arbitrary headers.
    process.stdout.write(JSON.stringify(record) + "\n");
  });

  next();
}
