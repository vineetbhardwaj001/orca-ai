import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./config.js";

describe("API environment configuration", () => {
  it("parses valid configuration and applies safe development defaults", () => {
    const config = loadApiConfig({
      DATABASE_URL: "postgresql://orca:local-only@localhost:5432/orca",
    });

    expect(config.apiPort).toBe(4000);
    expect(config.nodeEnv).toBe("development");
    expect(config.webBaseUrl).toBe("http://localhost:5173");
    expect(config.databaseSsl).toBe(false);
    expect(config.dbPoolMax).toBe(10);
  });

  it("rejects missing database configuration", () => {
    expect(() => loadApiConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rejects malformed ports, non-PostgreSQL URLs and non-origin dashboard URLs", () => {
    expect(() => loadApiConfig({
      DATABASE_URL: "https://example.com/database",
      API_PORT: "70000",
      WEB_BASE_URL: "http://localhost:5173/dashboard",
    })).toThrow(/Invalid API environment configuration/);
  });

  it("requires HTTPS and verified database TLS for production", () => {
    expect(() => loadApiConfig({
      NODE_ENV: "production",
      WEB_BASE_URL: "http://dashboard.example.test",
      DATABASE_URL: "postgresql://orca:secret@db.example.test:5432/orca",
    })).toThrow(/Production dashboard origins must use HTTPS/);
  });

  it("accepts explicitly configured TLS and production settings", () => {
    const config = loadApiConfig({
      NODE_ENV: "production",
      API_PORT: "8443",
      WEB_BASE_URL: "https://dashboard.example.test",
      DATABASE_URL: "postgresql://orca:secret@db.example.test:5432/orca",
      DATABASE_SSL: "true",
      DB_POOL_MAX: "20",
    });

    expect(config.nodeEnv).toBe("production");
    expect(config.apiPort).toBe(8443);
    expect(config.databaseSsl).toBe(true);
    expect(config.dbPoolMax).toBe(20);
  });
});
