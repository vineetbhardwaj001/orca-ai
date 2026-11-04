import { z } from "zod";

const apiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_BASE_URL: z.string().url().default("http://localhost:5173").refine((value) => {
    const parsed = new URL(value);
    return parsed.origin === value;
  }, "WEB_BASE_URL must be an exact origin without a trailing slash, path, query or fragment."),
  DATABASE_URL: z.string().url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  }, "DATABASE_URL must use the postgres or postgresql protocol."),
  DATABASE_SSL: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
}).superRefine((config, context) => {
  if (config.NODE_ENV !== "production") return;
  if (new URL(config.WEB_BASE_URL).protocol !== "https:") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["WEB_BASE_URL"],
      message: "Production dashboard origins must use HTTPS.",
    });
  }
  if (!config.DATABASE_SSL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_SSL"],
      message: "DATABASE_SSL=true is required in production.",
    });
  }
});

export type ApiConfig = {
  nodeEnv: "development" | "test" | "production";
  apiPort: number;
  webBaseUrl: string;
  databaseUrl: string;
  databaseSsl: boolean;
  dbPoolMax: number;
};

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = apiEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => issue.path.join(".") + ": " + issue.message)
      .join("; ");
    throw new Error("Invalid API environment configuration: " + details);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    apiPort: parsed.data.API_PORT,
    webBaseUrl: parsed.data.WEB_BASE_URL,
    databaseUrl: parsed.data.DATABASE_URL,
    databaseSsl: parsed.data.DATABASE_SSL,
    dbPoolMax: parsed.data.DB_POOL_MAX,
  };
}
