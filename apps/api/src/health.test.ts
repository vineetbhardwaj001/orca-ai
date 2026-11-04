import { describe, expect, it } from "vitest";
import { getHealthPayload } from "./health.js";
describe("API health payload", () => {
  it("returns a stable health envelope with an ISO timestamp", () => {
    const result = getHealthPayload(new Date("2026-11-04T12:00:00.000Z"));
    expect(result.success).toBe(true);
    expect(result.data.service).toBe("orca-api");
    expect(result.data.status).toBe("healthy");
    expect(result.data.time).toBe("2026-11-04T12:00:00.000Z");
  });
});
