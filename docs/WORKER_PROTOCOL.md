# ORCA Worker Protocol — v0.5

## Scope of this milestone

v0.5 implements the secure control-plane lifecycle and one deliberately narrow executable job: `echo`. It proves enrollment, worker authentication, heartbeat, organization/capability-scoped claim, leases, retry after lease expiry, revocation and result persistence.

It does **not** enable shell commands, arbitrary scripts, browser automation, external HTTP target testing, repository execution or unrestricted network access. The other values in the capability enum are reserved for future engines; a capability label alone does not implement an engine.

## Trust boundaries and transport

Workers make outbound HTTPS JSON requests to the ORCA control plane. They do not accept inbound connections and the control plane does not expose a remote shell or generic proxy.

- Use HTTPS for remote API endpoints. HTTP is accepted only for loopback development.
- Worker requests use an opaque bearer credential in the `Authorization: Bearer` header.
- Job completion additionally requires the per-claim `X-ORCA-Lease-Token` header.
- Redirects are rejected by the worker HTTP client.
- Request logs contain route metadata only; bearer credentials and lease tokens are never logged.

## Enrollment and credentials

An active organization owner or admin creates an enrollment token for a chosen capability set:

`POST /api/v1/organizations/:organizationId/workers/enrollment-tokens`

Example request:

~~~json
{
  "capabilities": ["worker.echo"]
}
~~~

The API returns a random URL-safe token once. It expires after 15 minutes and can be claimed once. Only its SHA-256 hash is stored in PostgreSQL. An active owner/admin is the authorization boundary; members and viewers cannot issue enrollment tokens.

A worker claims the token:

`POST /api/v1/worker-enrollments/claim`

~~~json
{
  "token": "ONE_TIME_ENROLLMENT_TOKEN",
  "workerName": "qa-worker-01"
}
~~~

The control plane creates an organization-bound worker, copies the authorized capability set from the token record and returns a random worker credential once. The worker credential expires after 30 days. Only its SHA-256 hash is stored. Revocation is immediate. Re-enroll with a new one-time token when replacing a credential or local worker installation.

Credential files are created with mode `0600` and their containing directory with mode `0700` on POSIX systems. Windows operators must ensure the worker user's profile directory has restrictive NTFS ACLs; Node's chmod does not tighten NTFS ACLs. Never commit, email, paste into logs or place these credentials in frontend/browser storage.

## Heartbeat

`POST /api/v1/workers/:workerId/heartbeat`

Headers: `Authorization: Bearer WORKER_CREDENTIAL`

~~~json
{
  "status": "IDLE",
  "version": "0.5.0"
}
~~~

Allowed statuses: `IDLE`, `BUSY`, `DEGRADED`. The API updates the last-heartbeat timestamp and worker status. The worker cannot add capabilities or change its organization binding via heartbeat; capabilities come from the owner/admin-authorized enrollment record.

The current runner sends heartbeats on startup, before/after a job and periodically while idle.

## Admin worker operations

Revoke an unclaimed enrollment token before it expires (owner/admin only):

`POST /api/v1/organizations/:organizationId/workers/enrollment-tokens/:tokenId/revoke`

List an organization's workers (owner/admin only):

`GET /api/v1/organizations/:organizationId/workers`

Revoke a worker immediately (owner/admin only):

`POST /api/v1/organizations/:organizationId/workers/:workerId/revoke`

Revocation invalidates the bearer credential, marks active leases revoked and requeues leased jobs when attempts remain. The admin list never returns credential hashes or raw credentials.

## Persisted echo jobs

Only an active project in the same organization can receive an echo job. An owner/admin creates it:

`POST /api/v1/organizations/:organizationId/jobs/echo`

~~~json
{
  "projectId": "PROJECT_UUID",
  "message": "hello from ORCA",
  "idempotencyKey": "client-generated-key-000001"
}
~~~

The idempotency key is unique within the organization. A repeated key returns HTTP 409. The job is persisted with type `echo` and required capability `worker.echo`.

A worker asks for work:

`POST /api/v1/workers/:workerId/jobs/claim`

The control plane authenticates the worker, rechecks its capability set, scopes the query to its organization and selects a queued job using a PostgreSQL row lock with `SKIP LOCKED`. This prevents two workers from acquiring the same live job. Only one live lease is allowed per worker.

The response contains a 60-second lease token and job payload. Only the hash of the lease token is persisted. The worker must complete before expiry:

`POST /api/v1/workers/:workerId/jobs/:jobId/complete`

Headers:
- `Authorization: Bearer WORKER_CREDENTIAL`
- `X-ORCA-Lease-Token: ONE_TIME_LEASE_TOKEN`

The control plane validates the active lease, worker ownership, result schema and that the echo result exactly matches the persisted input. A mismatched result is rejected and does not complete the job.

## Lease recovery and retries

- Lease duration: 60 seconds.
- Maximum attempts: 3.
- Expired leases are marked `expired`; the job returns to `queued` while attempts remain.
- A job that exhausts attempts is marked `failed`.
- A late worker cannot complete an expired or reassigned lease.
- Revocation marks active leases `revoked` and requeues the corresponding work only when attempts remain.
- A failed worker process does not blindly retry locally; the control plane owns lease recovery.

## Worker setup

1. Run migrations 0001, 0002 and 0003 against the intended database.
2. Start PostgreSQL and the API.
3. As an organization owner/admin, create an enrollment token with `worker.echo`.
4. Pass the token to the intended worker process as `ORCA_ENROLLMENT_TOKEN`; also set `ORCA_API_BASE_URL` and optionally `WORKER_NAME`.
5. From the repository root run `pnpm worker:dev`. The worker claims the enrollment token, stores the returned credential file, then heartbeats and polls for echo jobs.
6. Remove `ORCA_ENROLLMENT_TOKEN` from the worker environment after successful enrollment. Subsequent restarts read `ORCA_WORKER_CREDENTIAL_FILE`.
7. Create an echo job in an active project using the owner/admin API and observe it transition from `queued` to `leased` to `succeeded`.

For a packaged run, build with `pnpm worker:build` and start with `pnpm worker:start`.

## Database records

- `worker_enrollment_tokens`: one-use token hashes, allowed capabilities, issuer, expiry and used/revoked times.
- `workers`: organization binding, worker capability array, credential hash/expiry, status, version, heartbeat and revocation.
- `worker_jobs`: tenant/project-scoped payload, capability requirements, idempotency key, state, attempt count, active lease hash and persisted result.
- `worker_job_leases`: lease history with token hashes, expiry and completion/revocation state.

## Future protocol work

The existing shared job-envelope type documents future run/target scope and execution limits. v0.5 does not yet dispatch that broader envelope. Before enabling browser, API, repository or load engines, add target allowlist enforcement, DNS/redirect protections, sandbox isolation, runtime resource limits, cancellation, evidence validation, per-capability security review and an operator kill switch.


## Authorized targets and execution boundary (v0.6)

v0.6 adds a separate organization/project target registry. It does not change the v0.5 worker job protocol and it does not dispatch target jobs.

An active organization owner/admin registers a project target using `POST /api/v1/organizations/:organizationId/targets`. The request requires the project ID, exact HTTP(S) origin, explicit path prefixes, `authorizationConfirmed: true`, and an authorization expiry no more than ninety days away. Only standard web ports are accepted: HTTPS/443 or HTTP/80.

The API returns a one-time DNS TXT challenge. Publish the returned value at the supplied `_orca-verify.<hostname>` record name. Then call `POST /api/v1/organizations/:organizationId/targets/:targetId/verify`. ORCA verifies the exact TXT value, resolves the full A/AAAA address set and rejects the target if any answer is private, loopback, link-local, carrier-grade NAT, multicast, unspecified or reserved. The database stores only the challenge hash and stores the observed public IP set with a 24-hour verification freshness window.

Owners/admins can list targets with `GET /api/v1/organizations/:organizationId/targets` and revoke a pending or active target with `POST /api/v1/organizations/:organizationId/targets/:targetId/revoke`.

A future network executor must check that authorization has not expired, that DNS verification is still fresh, re-resolve the full address set, compare it with the approved snapshot and pin the approved IP for the socket connection. It must not resolve once and then connect by hostname. Automatic redirects must be disabled or each hop must be revalidated against the full target scope and DNS policy.

**Execution remains disabled in v0.6.** The onboarding API only records authorization and verifies DNS. No website is crawled, no API is called, no browser is launched and no arbitrary outbound connection is made by this milestone.
