import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { rateLimit } from "express-rate-limit";
import { describe, expect, it } from "vitest";

describe("API rate limiting", () => {
  it("rejects requests after the configured per-IP quota and returns rate-limit headers", async () => {
    const app = express();
    const limiter = rateLimit({
      windowMs: 60_000,
      limit: 1,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      identifier: "rate-limit-test",
      message: {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests. Please retry later." },
      },
    });

    app.get("/limited", limiter, (_req, res) => res.status(200).json({ success: true }));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/limited`;

    try {
      const first = await fetch(url);
      expect(first.status).toBe(200);

      const second = await fetch(url);
      expect(second.status).toBe(429);
      expect(second.headers.get("ratelimit")).toBeTruthy();
      expect(await second.json()).toEqual({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests. Please retry later." },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
