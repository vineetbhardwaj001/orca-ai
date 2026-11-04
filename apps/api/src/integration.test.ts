import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import pg from "pg";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { closePool } from "./db.js";
import type { TargetDnsResolver } from "./targets/security.js";

const { Pool } = pg;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const requireDbIntegration = process.env.REQUIRE_DB_INTEGRATION === "true";
const testOrigin = "http://localhost:5173";
let targetDnsAnswers = [{ address: "8.8.8.8", family: 4 }];
let targetTxtRecords: string[][] = [];
const targetDnsResolver: TargetDnsResolver = {
  lookup: async () => targetDnsAnswers,
  resolveTxt: async () => targetTxtRecords,
};

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
    enrollment?: { id: string };
    enrollmentToken?: string;
    credential?: string;
    worker?: { id: string; organizationId: string; capabilities: string[] };
    workers?: Array<{ id: string; capabilities: string[]; revoked_at: string | null }>;
    job?: {
      id?: string; jobId?: string; status?: string; payload?: { message: string };
      attempt?: number; lease?: { id: string; token: string; expiresAt: string };
    } | null;
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
 
  async function createWorkerEnrollment(user: UserSession, capabilities = ["worker.echo"]): Promise<string> {
    const response = await api(`/api/v1/organizations/${user.organizationId}/workers/enrollment-tokens`, {
      method: "POST",
      body: JSON.stringify({ capabilities }),
    }, user.cookie);
    const payload = await response.json() as ApiPayload;
    if (response.status !== 201 || !payload.data?.enrollmentToken) {
      throw new Error(`Worker enrollment token creation failed with HTTP ${response.status}`);
    }
    return payload.data.enrollmentToken;
  }

  async function enrollWorker(token: string, workerName = "Integration worker"): Promise<{ id: string; credential: string }> {
    const response = await api("/api/v1/worker-enrollments/claim", {
      method: "POST",
      body: JSON.stringify({ token, workerName }),
    });
    const payload = await response.json() as ApiPayload;
    if (response.status !== 201 || !payload.data?.worker?.id || !payload.data.credential) {
      throw new Error(`Worker enrollment claim failed with HTTP ${response.status}`);
    }
    return { id: payload.data.worker.id, credential: payload.data.credential };
  }

  function workerHeaders(credential: string, leaseToken?: string): Headers {
    const headers = new Headers({ authorization: "Bearer " + credential });
    if (leaseToken) headers.set("x-orca-lease-token", leaseToken);
    return headers;
  }

  async function createEchoJob(user: UserSession, projectId: string, idempotencyKey = "echo-test-key-0001") {
    return api(`/api/v1/organizations/${user.organizationId}/jobs/echo`, {
      method: "POST",
      body: JSON.stringify({ projectId, message: "hello from ORCA worker", idempotencyKey }),
    }, user.cookie);
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
      new URL("../migrations/0003_secure_workers_and_jobs.sql", import.meta.url),
      new URL("../migrations/0004_secure_target_authorization.sql", import.meta.url),
    ];
    for (const migration of migrations) {
      await getTestPool().query(await readFile(migration, "utf8"));
    }

    server = createApp({ targetDnsResolver }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await getTestPool().query("TRUNCATE worker_job_leases, worker_jobs, workers, worker_enrollment_tokens, auth_sessions, projects, organization_members, organizations, users RESTART IDENTITY CASCADE");
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

  it("requires explicit owner authorization and DNS proof before activating a project target", async () => {
    const owner = await register("target-owner@example.test");
    const projectId = await createProject(owner, "Authorized Target Project");
    const authorizationExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const created = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {
      method: "POST",
      body: JSON.stringify({
        projectId,
        baseUrl: "https://QA-Target.example.com",
        pathPrefixes: ["/", "/api/v1"],
        authorizationConfirmed: true,
        authorizationExpiresAt,
      }),
    }, owner.cookie);
    const createdPayload = await created.json() as ApiPayload;
    expect(created.status).toBe(201);
    expect(createdPayload.data?.target).toEqual(expect.objectContaining({
      status: "pending_verification",
      hostname: "qa-target.example.com",
    }));
    expect(createdPayload.data?.executionEnabled).toBe(false);
    const targetId = createdPayload.data!.target!.id;
    const dnsProof = createdPayload.data!.dnsVerification!;
    expect(dnsProof.recordName).toBe("_orca-verify.qa-target.example.com");
    expect(dnsProof.recordType).toBe("TXT");
    expect(dnsProof.recordValue).toMatch(/^orca-verification=[A-Za-z0-9_-]{43}$/);

    const stored = await getTestPool().query<{ verification_token_hash: string; status: string }>(
      "SELECT verification_token_hash, status FROM authorized_targets WHERE id = $1",
      [targetId],
    );
    expect(stored.rows[0]?.verification_token_hash).toHaveLength(64);
    expect(stored.rows[0]?.verification_token_hash).not.toBe(dnsProof.recordValue);
    expect(stored.rows[0]?.status).toBe("pending_verification");

    const duplicate = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {
      method: "POST",
      body: JSON.stringify({
        projectId,
        baseUrl: "https://qa-target.example.com",
        pathPrefixes: ["/"],
        authorizationConfirmed: true,
        authorizationExpiresAt,
      }),
    }, owner.cookie);
    expect(duplicate.status).toBe(409);

    targetTxtRecords = [[dnsProof.recordValue.slice(0, 25), dnsProof.recordValue.slice(25)]];
    const verified = await api(`/api/v1/organizations/${owner.organizationId}/targets/${targetId}/verify`, {
      method: "POST",
    }, owner.cookie);
    const verifiedPayload = await verified.json() as ApiPayload;
    expect(verified.status).toBe(200);
    expect(verifiedPayload.data?.target?.status).toBe("active");
    expect(verifiedPayload.data?.executionEnabled).toBe(false);

    const savedResolution = await getTestPool().query<{ resolved_addresses: string[]; verification_expires_at: Date }>(
      "SELECT resolved_addresses, verification_expires_at FROM authorized_targets WHERE id = $1",
      [targetId],
    );
    expect(savedResolution.rows[0]?.resolved_addresses).toEqual(["8.8.8.8"]);
    expect(new Date(savedResolution.rows[0]!.verification_expires_at).getTime()).toBeGreaterThan(Date.now());

    const list = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {}, owner.cookie);
    const listPayload = await list.json() as ApiPayload;
    expect(list.status).toBe(200);
    expect(listPayload.data?.targets).toHaveLength(1);
    expect(listPayload.data?.targets?.[0]?.status).toBe("active");

    const revoked = await api(`/api/v1/organizations/${owner.organizationId}/targets/${targetId}/revoke`, {
      method: "POST",
    }, owner.cookie);
    expect(revoked.status).toBe(200);
    const revokedState = await getTestPool().query<{ status: string; revoked_at: Date | null }>(
      "SELECT status, revoked_at FROM authorized_targets WHERE id = $1",
      [targetId],
    );
    expect(revokedState.rows[0]).toEqual({ status: "revoked", revoked_at: expect.any(Date) });
  });

  it("denies non-admin target onboarding and rejects missing authorization attestation", async () => {
    const owner = await register("target-rbac-owner@example.test");
    const projectId = await createProject(owner, "Target RBAC Project");
    const viewer = await register("target-rbac-viewer@example.test");
    await addMembership(viewer.userId, owner.organizationId, "viewer");
    const input = {
      projectId,
      baseUrl: "https://rbac-target.example.com",
      pathPrefixes: ["/"],
      authorizationConfirmed: true,
      authorizationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const forbidden = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {
      method: "POST", body: JSON.stringify(input),
    }, viewer.cookie);
    expect(forbidden.status).toBe(403);

    const missingAttestation = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {
      method: "POST", body: JSON.stringify({ ...input, authorizationConfirmed: false }),
    }, owner.cookie);
    expect(missingAttestation.status).toBe(400);

    const crossTenant = await register("target-rbac-other@example.test");
    const otherTenantList = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {}, crossTenant.cookie);
    expect(otherTenantList.status).toBe(403);
  });

  it("blocks private and mixed public/private DNS answers during target verification", async () => {
    const owner = await register("target-ssrf-owner@example.test");
    const projectId = await createProject(owner, "Target SSRF Project");
    const created = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {
      method: "POST",
      body: JSON.stringify({
        projectId,
        baseUrl: "https://ssrf-target.example.com",
        pathPrefixes: ["/api"],
        authorizationConfirmed: true,
        authorizationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    }, owner.cookie);
    const createdPayload = await created.json() as ApiPayload;
    expect(created.status).toBe(201);
    const targetId = createdPayload.data!.target!.id;
    targetTxtRecords = [[createdPayload.data!.dnsVerification!.recordValue]];

    targetDnsAnswers = [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    const blocked = await api(`/api/v1/organizations/${owner.organizationId}/targets/${targetId}/verify`, {
      method: "POST",
    }, owner.cookie);
    const blockedPayload = await blocked.json() as ApiPayload;
    expect(blocked.status).toBe(422);
    expect(blockedPayload.error?.code).toBe("TARGET_DNS_NOT_PUBLIC");

    const unchanged = await getTestPool().query<{ status: string; dns_verified_at: Date | null }>(
      "SELECT status, dns_verified_at FROM authorized_targets WHERE id = $1",
      [targetId],
    );
    expect(unchanged.rows[0]).toEqual({ status: "pending_verification", dns_verified_at: null });
  });

  it("rejects expired authorization windows and non-web ports before creating target records", async () => {
    const owner = await register("target-invalid-owner@example.test");
    const projectId = await createProject(owner, "Invalid Target Project");
    const baseInput = {
      projectId,
      pathPrefixes: ["/"],
      authorizationConfirmed: true,
      authorizationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const expired = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {
      method: "POST",
      body: JSON.stringify({ ...baseInput, baseUrl: "https://expiry-target.example.com", authorizationExpiresAt: new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString() }),
    }, owner.cookie);
    expect(expired.status).toBe(400);

    const nonWebPort = await api(`/api/v1/organizations/${owner.organizationId}/targets`, {
      method: "POST",
      body: JSON.stringify({ ...baseInput, baseUrl: "https://port-target.example.com:8443" }),
    }, owner.cookie);
    expect(nonWebPort.status).toBe(400);

    const count = await getTestPool().query<{ count: string }>("SELECT count(*)::text AS count FROM authorized_targets");
    expect(count.rows[0]?.count).toBe("0");
  });

  it("issues a one-time enrollment token and stores only worker credential hashes", async () => {
    const owner = await register("worker-enrollment-owner@example.test");
    const token = await createWorkerEnrollment(owner);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const enrolled = await enrollWorker(token, "Local echo worker");
    expect(enrolled.credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(enrolled.id).toMatch(/^[0-9a-f-]{36}$/);

    const duplicate = await api("/api/v1/worker-enrollments/claim", {
      method: "POST",
      body: JSON.stringify({ token, workerName: "Duplicate worker" }),
    });
    expect(duplicate.status).toBe(401);

    const stored = await getTestPool().query<{ credential_hash: string }>(
      "SELECT credential_hash FROM workers WHERE id = $1",
      [enrolled.id],
    );
    expect(stored.rows[0]?.credential_hash).toHaveLength(64);
    expect(stored.rows[0]?.credential_hash).not.toBe(enrolled.credential);
  });

  it("lets an organization owner revoke an unclaimed enrollment token before expiry", async () => {
    const owner = await register("worker-token-revoke-owner@example.test");
    const issued = await api(`/api/v1/organizations/${owner.organizationId}/workers/enrollment-tokens`, {
      method: "POST",
      body: JSON.stringify({ capabilities: ["worker.echo"] }),
    }, owner.cookie);
    const issuedPayload = await issued.json() as ApiPayload;
    const tokenId = issuedPayload.data?.enrollment?.id;
    const token = issuedPayload.data?.enrollmentToken;
    expect(issued.status).toBe(201);
    expect(tokenId).toBeDefined();
    expect(token).toBeDefined();

    const revoked = await api(`/api/v1/organizations/${owner.organizationId}/workers/enrollment-tokens/${tokenId}/revoke`, {
      method: "POST", body: "{}",
    }, owner.cookie);
    expect(revoked.status).toBe(200);

    const claim = await api("/api/v1/worker-enrollments/claim", {
      method: "POST",
      body: JSON.stringify({ token, workerName: "Should not enroll" }),
    });
    expect(claim.status).toBe(401);
  });

  it("runs a persisted echo job through authenticated heartbeat, lease and result completion", async () => {
    const owner = await register("worker-echo-owner@example.test");
    const projectId = await createProject(owner, "Worker Echo Project");
    const enrollmentToken = await createWorkerEnrollment(owner);
    const worker = await enrollWorker(enrollmentToken, "Echo executor");

    const noCredential = await api(`/api/v1/workers/${worker.id}/heartbeat`, {
      method: "POST", body: JSON.stringify({ status: "IDLE" }),
    });
    expect(noCredential.status).toBe(401);

    const heartbeat = await api(`/api/v1/workers/${worker.id}/heartbeat`, {
      method: "POST",
      headers: workerHeaders(worker.credential),
      body: JSON.stringify({ status: "IDLE", version: "0.5.0", capabilities: ["api.http"] }),
    });
    expect(heartbeat.status).toBe(200);
    const unchangedCapabilities = await getTestPool().query<{ capabilities: string[] }>(
      "SELECT capabilities FROM workers WHERE id = $1",
      [worker.id],
    );
    expect(unchangedCapabilities.rows[0]?.capabilities).toEqual(["worker.echo"]);

    const queued = await createEchoJob(owner, projectId, "echo-idempotency-key-0001");
    expect(queued.status).toBe(202);
    const duplicate = await createEchoJob(owner, projectId, "echo-idempotency-key-0001");
    expect(duplicate.status).toBe(409);

    const claimResponse = await api(`/api/v1/workers/${worker.id}/jobs/claim`, {
      method: "POST", headers: workerHeaders(worker.credential), body: "{}",
    });
    const claimPayload = await claimResponse.json() as ApiPayload;
    expect(claimResponse.status).toBe(200);
    expect(claimPayload.data?.job?.payload?.message).toBe("hello from ORCA worker");
    expect(claimPayload.data?.job?.attempt).toBe(1);
    const job = claimPayload.data!.job!;
    const jobId = job.jobId!;
    const leaseToken = job.lease!.token;

    const wrongResult = await api(`/api/v1/workers/${worker.id}/jobs/${jobId}/complete`, {
      method: "POST",
      headers: workerHeaders(worker.credential, leaseToken),
      body: JSON.stringify({
        echo: "tampered",
        workerId: worker.id,
        processedAt: "2026-11-04T15:00:00.000Z",
      }),
    });
    expect(wrongResult.status).toBe(422);

    const completed = await api(`/api/v1/workers/${worker.id}/jobs/${jobId}/complete`, {
      method: "POST",
      headers: workerHeaders(worker.credential, leaseToken),
      body: JSON.stringify({
        echo: "hello from ORCA worker",
        workerId: worker.id,
        processedAt: "2026-11-04T15:00:01.000Z",
      }),
    });
    expect(completed.status).toBe(200);

    const persisted = await getTestPool().query<{ status: string; result: { echo: string } }>(
      "SELECT status, result FROM worker_jobs WHERE id = $1",
      [jobId],
    );
    expect(persisted.rows[0]).toEqual({
      status: "succeeded",
      result: expect.objectContaining({ echo: "hello from ORCA worker", workerId: worker.id }),
    });

    const lease = await getTestPool().query<{ status: string }>(
      "SELECT status FROM worker_job_leases WHERE job_id = $1",
      [jobId],
    );
    expect(lease.rows[0]?.status).toBe("completed");
  });

  it("does not dispatch jobs across organizations or to workers missing the required capability", async () => {
    const ownerA = await register("worker-scope-a@example.test");
    const projectA = await createProject(ownerA, "Organization A Worker Project");
    const queued = await createEchoJob(ownerA, projectA, "echo-scope-test-key-0001");
    expect(queued.status).toBe(202);

    const ownerB = await register("worker-scope-b@example.test");
    const workerB = await enrollWorker(await createWorkerEnrollment(ownerB), "Other organization worker");
    const foreignClaim = await api(`/api/v1/workers/${workerB.id}/jobs/claim`, {
      method: "POST", headers: workerHeaders(workerB.credential), body: "{}",
    });
    expect((await foreignClaim.json() as ApiPayload).data?.job).toBeNull();

    const limitedWorker = await enrollWorker(
      await createWorkerEnrollment(ownerA, ["api.http"]),
      "Capability-limited worker",
    );
    const capabilityClaim = await api(`/api/v1/workers/${limitedWorker.id}/jobs/claim`, {
      method: "POST", headers: workerHeaders(limitedWorker.credential), body: "{}",
    });
    expect((await capabilityClaim.json() as ApiPayload).data?.job).toBeNull();
    const stillQueued = await getTestPool().query<{ status: string }>(
      "SELECT status FROM worker_jobs WHERE id = (SELECT id FROM worker_jobs WHERE idempotency_key = $1)",
      ["echo-scope-test-key-0001"],
    );
    expect(stillQueued.rows[0]?.status).toBe("queued");
  });

  it("expires old leases, bounds retries and makes a revoked worker credential unusable", async () => {
    const owner = await register("worker-lease-owner@example.test");
    const projectId = await createProject(owner, "Lease Retry Project");
    const first = await enrollWorker(await createWorkerEnrollment(owner), "First worker");
    const second = await enrollWorker(await createWorkerEnrollment(owner), "Second worker");
    const created = await createEchoJob(owner, projectId, "echo-lease-retry-key-0001");
    const queued = await created.json() as ApiPayload;
    const jobId = queued.data!.job!.id!;

    const firstClaimResponse = await api(`/api/v1/workers/${first.id}/jobs/claim`, {
      method: "POST", headers: workerHeaders(first.credential), body: "{}",
    });
    const firstClaim = await firstClaimResponse.json() as ApiPayload;
    const firstLease = firstClaim.data!.job!.lease!.token;

    await getTestPool().query(
      "UPDATE worker_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = $1",
      [jobId],
    );
    const secondClaimResponse = await api(`/api/v1/workers/${second.id}/jobs/claim`, {
      method: "POST", headers: workerHeaders(second.credential), body: "{}",
    });
    const secondClaim = await secondClaimResponse.json() as ApiPayload;
    expect(secondClaim.data?.job?.attempt).toBe(2);

    const oldLeaseCompletion = await api(`/api/v1/workers/${first.id}/jobs/${jobId}/complete`, {
      method: "POST",
      headers: workerHeaders(first.credential, firstLease),
      body: JSON.stringify({
        echo: "hello from ORCA worker",
        workerId: first.id,
        processedAt: "2026-11-04T15:00:02.000Z",
      }),
    });
    expect(oldLeaseCompletion.status).toBe(409);

    const revoked = await api(`/api/v1/organizations/${owner.organizationId}/workers/${second.id}/revoke`, {
      method: "POST", body: "{}",
    }, owner.cookie);
    expect(revoked.status).toBe(200);
    const revokedHeartbeat = await api(`/api/v1/workers/${second.id}/heartbeat`, {
      method: "POST",
      headers: workerHeaders(second.credential),
      body: JSON.stringify({ status: "IDLE" }),
    });
    expect(revokedHeartbeat.status).toBe(401);

    const leaseStatuses = await getTestPool().query<{ status: string }>(
      "SELECT status FROM worker_job_leases WHERE worker_id = $1 ORDER BY claimed_at",
      [second.id],
    );
    expect(leaseStatuses.rows[0]?.status).toBe("revoked");
  });

  it("restricts worker enrollment and echo-job creation to organization owners and admins", async () => {
    const owner = await register("worker-rbac-owner@example.test");
    const projectId = await createProject(owner, "Worker RBAC Project");
    const viewer = await register("worker-rbac-viewer@example.test");
    await addMembership(viewer.userId, owner.organizationId, "viewer");

    const forbiddenEnrollment = await api(`/api/v1/organizations/${owner.organizationId}/workers/enrollment-tokens`, {
      method: "POST", body: JSON.stringify({ capabilities: ["worker.echo"] }),
    }, viewer.cookie);
    expect(forbiddenEnrollment.status).toBe(403);

    const forbiddenJob = await api(`/api/v1/organizations/${owner.organizationId}/jobs/echo`, {
      method: "POST",
      body: JSON.stringify({ projectId, message: "not allowed", idempotencyKey: "viewer-job-key-000001" }),
    }, viewer.cookie);
    expect(forbiddenJob.status).toBe(403);

    const admin = await register("worker-rbac-admin@example.test");
    await addMembership(admin.userId, owner.organizationId, "admin");
    expect((await api(`/api/v1/organizations/${owner.organizationId}/workers/enrollment-tokens`, {
      method: "POST", body: JSON.stringify({ capabilities: ["worker.echo"] }),
    }, admin.cookie)).status).toBe(201);
    expect((await api(`/api/v1/organizations/${owner.organizationId}/jobs/echo`, {
      method: "POST",
      body: JSON.stringify({ projectId, message: "admin job", idempotencyKey: "admin-job-key-000001" }),
    }, admin.cookie)).status).toBe(202);
  });

});
