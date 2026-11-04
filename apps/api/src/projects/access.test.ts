import { describe, expect, it } from "vitest";
import { canArchiveProjects, canReadProjects, canWriteProjects } from "./access.js";

describe("organization project permissions", () => {
  it("allows every active role to read projects", () => {
    for (const role of ["owner", "admin", "member", "viewer"] as const) {
      expect(canReadProjects(role)).toBe(true);
    }
  });

  it("allows owners, admins and members to create or update projects", () => {
    expect(canWriteProjects("owner")).toBe(true);
    expect(canWriteProjects("admin")).toBe(true);
    expect(canWriteProjects("member")).toBe(true);
    expect(canWriteProjects("viewer")).toBe(false);
  });

  it("restricts project archiving to owners and admins", () => {
    expect(canArchiveProjects("owner")).toBe(true);
    expect(canArchiveProjects("admin")).toBe(true);
    expect(canArchiveProjects("member")).toBe(false);
    expect(canArchiveProjects("viewer")).toBe(false);
  });
});
