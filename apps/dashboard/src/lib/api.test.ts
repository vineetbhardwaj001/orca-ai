import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getCurrentSession, listProjects } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dashboard API client", () => {
  it("sends cookie credentials and validates current-session response data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: "8d0a3d7a-8442-4b54-9f9d-5a9d92c2cbd1",
          name: "ORCA User",
          email: "orca@example.test",
        },
        organizations: [{
          organization_id: "3f6bb5ab-4a4b-4d7d-8a0e-9c4b8b6f4e30",
          organization_name: "ORCA Workspace",
          role: "owner",
        }],
      },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const session = await getCurrentSession();

    expect(session.user.email).toBe("orca@example.test");
    expect(session.organizations[0]?.role).toBe("owner");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/me", expect.objectContaining({
      credentials: "include",
      headers: expect.any(Headers),
    }));
  });

  it("surfaces server errors as typed API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." },
    }), { status: 401, headers: { "content-type": "application/json" } })));

    await expect(getCurrentSession()).rejects.toMatchObject({
      name: "ApiError",
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  it("rejects malformed data instead of silently trusting it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { projects: [{ id: "not-a-uuid" }] },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    await expect(listProjects("3f6bb5ab-4a4b-4d7d-8a0e-9c4b8b6f4e30")).rejects.toBeInstanceOf(ApiError);
  });
});
