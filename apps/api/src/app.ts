import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getHealthPayload } from "./health.js";
import { authRouter } from "./auth/routes.js";
import { projectsRouter } from "./projects/routes.js";

export function createApp() {
  const app = express();
  const origin = process.env.WEB_BASE_URL ?? "http://localhost:5173";

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // Enforce same-origin browser mutations across cookie-authenticated APIs.
  app.use((req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    const requestOrigin = req.get("origin");
    if (req.headers.cookie && requestOrigin !== origin) {
      return res.status(403).json({ success: false, error: { code: "ORIGIN_NOT_ALLOWED", message: "Cookie-authenticated mutations must originate from the configured UI." } });
    }
    if (requestOrigin && requestOrigin !== origin) {
      return res.status(403).json({ success: false, error: { code: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed." } });
    }
    return next();
  });

  app.get("/health", (_req, res) => res.status(200).json(getHealthPayload()));
  app.get("/api/v1", (_req, res) => res.status(200).json({
    success: true,
    data: { name: "ORCA API", version: "v1", stage: "control-plane-foundation" },
  }));
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/organizations", projectsRouter);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled API error", error instanceof Error ? error.name : "UnknownError");
    return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  });

  return app;
}
