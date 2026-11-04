import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import pg from "pg";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { closePool } from "./db.js";

const { Pool } = pg;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const requireDbIntegration = process.env.REQUIRE_DB_INTEGRATION === "true";
const testOrigin = "http://localhost:5173";

if (requireDbIntegration && !testDatabaseUrl) {
  throw new Error("REQUIRE_DB_INTEGRATION=true but TEST_DATABASE_URL is missing; refusing to silently skip the PostgreSQL integration suite.");
}

// Refuse destructive setup against any database not explicitly named orca_test.
if (testDatabaseUrl) {
  const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "");
  if (databaseName !== "orca_test") {
    throw new Error("TEST_DATABASE_URL must point to a database named orca_test; refusing destructive integration-test setup.");
  }
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.WEB_BASE_URL = testOrigin;
  process.env.NODE_ENV = "test";
}

type UserSession = { userId: string; organizationId: string; cookie: string };
type ApiPayload = {
  success: boolean;
  data?: {
    user?: { id: string; email: string };
    organizationId?: string;
    organizations?: Array<{ organization_id: string; role: string }>;
    projects?: Array<{ id: string; name: string; status: string }>;
    project?: { id: string; name: string; status: string };
  };
  error?: { code: string; message: string };
};

describe.skipIf(!testDatabaseUrl)("PostgreSQL-backed API integration", () => {
  let database: pg.Pool | undefined;
  let server: Server | undefined;
  let baseUrl = "";

  function getTestPool(): pg.Pool {
    if (!database) throw new Error("PostgreSQL integration test pool is not initialized.");
    return database;
  }

  async function api(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("origin", testOrigin);
    if (cookie) headers.set("cookie", cookie);
    if (init.body) headers.set("content-type", "application/json");
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  }

  async function register(email: string): Promise<UserSession> {
    const response = await api("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Test User", email, password: "correct-horse-battery", organizationName: "Test Workspace" }),
    });
    const payload = await response.json() as ApiPayload;
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (response.status !== 201 || !payload.data?.user?.id || !payload.data.organizationId || !cookie) {
      throw new Error(`Test registration failed with HTTP ${response.status}: ${payload.error?.code ?? "UNKNOWN"}`);
    }
    return { userId: payload.data.user.id, organizationId: payload.data.organizationId, cookie };
  }

  async function createProject(user: UserSession, name = "QA Project"): Promise<string> {
    const response = await api(`/api/v1/organizations/${user.organizationId}/projects`, {
      method: "POST",
      body: JSON.stringify({ name, description: "Integration fixture" }),
    }, user.cookie);
    const payload = await response.json() as ApiPayload;
    if (response.status !== 201 || !payload.data?.project?.id) {
      throw new Error(`Project fixture creation failed with HTTP ${response.status}`);
    }
    return payload.data.project.id;
  }

  async function addMembership(userId: string, organizationId: string, role: "admin" | "member" | "viewer") {
    await getTestPool().query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)",
      [organizationId, userId, role],
    );
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required in CI for PostgreSQL integration tests.");
    database = new Pool({ connectionString: testDatabaseUrl, max: 3 });

    const migrations = [
      new URL("../migrations/0001_identity_tenancy.sql", import.meta.url),
      new URL("../migrations/0002_project_lifecycle.sql", import.meta.url),
    ];
    for (const migration of migrations) {
      await getTestPool().query(await readFile(migration, "utf8"));
    }

    server = createApp().listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await getTestPool().query("TRUNCATE auth_sessions, projects, organization_members, organizations, users RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => error ? reject(error) : resolve());
      });
    }
    await closePool();
    if (database) await database.end();
  });

  it("registers an owner workspace and returns current identity and membership", async () => {
    const owner = await register("owner@example.test");
    const response = await api("/api/v1/auth/me", {}, owner.cookie);
    const payload = await response.json() as ApiPayload;
    expect(response.status).toBe(200);
    expect(payload.data?.user?.id).toBe(owner.userId);
    expect(payload.data?.organizations).toEqual([
      expect.objectContaining({ organization_id: owner.organizationId, role: "owner" }),
    ]);
  });

  it("rejects duplicate emails case-insensitively and rejects bad credentials", async () => {
    await register("duplicate@example.test");
    const duplicate = await api("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Duplicate User", email: "DUPLICATE@example.test", password: "correct-horse-battery", organizationName: "Another Workspace" }),
    });
    expect(duplicate.status).toBe(409);

    const badLogin = await api("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "duplicate@example.test", password: "wrong-password" }),
    });
    expect(badLogin.status).toBe(401);
  });

  it("requires authentication and revokes a session on logout", async () => {
    const anonymous = await api("/api/v1/organizations/00000000-0000-4000-8000-000000000001/projects");
    expect(anonymous.status).toBe(401);
    const user = await register("logout@example.test");
    const logout = await api("/api/v1/auth/logout", { method: "POST" }, user.cookie);
    expect(logout.status).toBe(200);
    expect((await api("/api/v1/auth/me", {}, user.cookie)).status).toBe(401);
  });

  it("prevents cross-tenant list, read, update and archive access", async () => {
    const owner = await register("tenant-a@example.test");
    const projectId = await createProject(owner, "Private Tenant A Project");
    const otherTenant = await register("tenant-b@example.test");

    const list = await api(`/api/v1/organizations/${owner.organizationId}/projects`, {}, otherTenant.cookie);
    expect(list.status).toBe(200);
    expect((await list.json() as ApiPayload).data?.projects).toHaveLength(0);

    const resourcePath = `/api/v1/organizations/${owner.organizationId}/projects/${projectId}`;
    expect((await api(resourcePath, {}, otherTenant.cookie)).status).toBe(404);
    expect((await api(resourcePath, { method: "PATCH", body: JSON.stringify({ name: "Unauthorized rewrite" }) }, otherTenant.cookie)).status).toBe(404);
    expect((await api(`${resourcePath}/archive`, { method: "POST" }, otherTenant.cookie)).status).toBe(404);
  });

  it("enforces viewer, member and admin project permissions in PostgreSQL", async () => {
    const owner = await register("roles-owner@example.test");
    const ownerProjectId = await createProject(owner, "Role Matrix Project");

    const viewer = await register("viewer@example.test");
    await addMembership(viewer.userId, owner.organizationId, "viewer");
    const viewerList = await api(`/api/v1/organizations/${owner.organizationId}/projects`, {}, viewer.cookie);
    expect(viewerList.status).toBe(200);
    expect((await viewerList.json() as ApiPayload).data?.projects).toHaveLength(1);
    expect((await api(`/api/v1/organizations/${owner.organizationId}/projects`, {
      method: "POST", body: JSON.stringify({ name: "Viewer Project" }),
    }, viewer.cookie)).status).toBe(403);

    const ownerProjectPath = `/api/v1/organizations/${owner.organizationId}/projects/${ownerProjectId}`;
    expect((await api(ownerProjectPath, { method: "PATCH", body: JSON.stringify({ name: "Viewer Cannot Edit" }) }, viewer.cookie)).status).toBe(404);
    expect((await api(`${ownerProjectPath}/archive`, { method: "POST" }, viewer.cookie)).status).toBe(404);

    const member = await register("member@example.test");
    await addMembership(member.userId, owner.organizationId, "member");
    const memberCreate = await api(`/api/v1/organizations/${owner.organizationId}/projects`, {
      method: "POST", body: JSON.stringify({ name: "Member Project" }),
    }, member.cookie);
    const memberPayload = await memberCreate.json() as ApiPayload;
    expect(memberCreate.status).toBe(201);
    const memberProjectId = memberPayload.data!.project!.id;

    const memberProjectPath = `/api/v1/organizations/${owner.organizationId}/projects/${memberProjectId}`;
    expect((await api(memberProjectPath, { method: "PATCH", body: JSON.stringify({ description: "Updated by member" }) }, member.cookie)).status).toBe(200);
    expect((await api(`${memberProjectPath}/archive`, { method: "POST" }, member.cookie)).status).toBe(404);

    const admin = await register("admin@example.test");
    await addMembership(admin.userId, owner.organizationId, "admin");
    const adminArchive = await api(`${ownerProjectPath}/archive`, { method: "POST" }, admin.cookie);
    expect(adminArchive.status).toBe(200);
    expect((await adminArchive.json() as ApiPayload).data?.project?.status).toBe("archived");
  });
});
