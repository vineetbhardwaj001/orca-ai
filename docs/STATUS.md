# ORCA AI — Current Engineering Status

Last verified: 2026-11-04  
Current main baseline at v0.5 branch creation: 5a0f166ecffab37e430f92364d2b9a32dc638ae0  
v0.5 branch: feat/secure-worker-enrollment-jobs-v0.5.0  
Target package version: 0.5.0-alpha.1

## GitHub state

- PR #3 (identity, tenancy and project RBAC) is merged.
- PR #4 (repository readiness and CodeQL) is merged.
- PR #5 (control-plane PostgreSQL integration verification) is merged.
- PR #6 (dashboard and application integration v0.4.0-alpha.1) is merged.
- The current v0.5 feature branch starts from the updated main after PR #6.
- Main CI and CodeQL passed for the previous v0.4 milestone; this v0.5 branch still requires its own CI and CodeQL validation.
- No production deployment or full autonomous QA engine is claimed.

## Implemented milestones

### v0.1.0 — Identity and project-management foundation
- PostgreSQL identity, organization, membership, project and session schema.
- Register, login, logout and current-session API.
- Scrypt password hashing and opaque HttpOnly session cookies with token-hash persistence.
- Organization-scoped project list/create/read/update/archive endpoints.
- Server-side membership and role policy checks.

### v0.2.0-alpha.1 — Repository readiness
- Monorepo documentation, license, environment templates, contribution/security guidance.
- CI workflow hardening and CodeQL analysis.

### v0.3.0-alpha.1 — Control-plane verification
- Express app factory and graceful shutdown.
- PostgreSQL 16 integration suite for identity, session revocation, tenant isolation and project role matrix.
- CI fails instead of silently skipping required database integration tests.

### v0.4.0-alpha.1 — Dashboard and application integration (PR #6; merged)
- Real dashboard signup/login/session restoration/logout.
- Organization membership context and project list/create/read/update/archive UI.
- Typed, credentialed API client with Zod response validation and abort cancellation.
- API runtime configuration validation, request IDs and metadata-only structured logs.
- Playwright registration/project lifecycle/logout/login journey in CI.
- CI run #82 and CodeQL run #10 passed on the v0.4 final branch head.

## v0.5.0-alpha.1 — Secure worker enrollment and job execution

Implemented on `feat/secure-worker-enrollment-jobs-v0.5.0`; feature-branch validation is pending.

- Added migration 0003 for one-time enrollment token hashes, organization-bound worker identities, worker jobs and lease history. Added composite tenant-consistency foreign keys and unique organization-scoped idempotency keys.
- Added owner/admin routes to issue one-use 15-minute enrollment tokens, revoke unclaimed tokens, list workers, revoke workers and enqueue echo jobs.
- Added worker enrollment claim endpoint. A token can be consumed once; a 30-day random worker credential is returned once and only its SHA-256 hash is stored.
- Added bearer-authenticated heartbeats. Worker capabilities are copied from the admin-authorized enrollment record and cannot be escalated through heartbeat payloads.
- Added PostgreSQL row-lock/skip-locked job claim, 60-second per-job lease, three-attempt expiry recovery and persisted lease history.
- Added lease-token-protected result completion. The control plane verifies the active lease, worker identity, result schema and exact echo-vs-input match.
- Added immediate worker revocation. Active leases are revoked and jobs are requeued while retry attempts remain.
- Replaced the worker bootstrap with a small HTTP worker client, protected local credential file and deterministic echo-job executor.
- Added unit tests for token primitives, credential-file protections and echo-job validation; PostgreSQL tests also cover early enrollment-token revocation and owner/admin policy.
- Extended PostgreSQL integration tests for one-use enrollment, hashed credential storage, heartbeat, echo round-trip, idempotency, organization isolation, capability filtering, expired/reassigned leases and revocation.
- Updated worker protocol, database schema/migration, security, environment and operator documentation.

### v0.5 scope limit

The worker can execute only the deterministic `echo` job. It does not run shell commands, arbitrary scripts, browser automation, target HTTP tests, repository code or load tests. The other worker capability labels are declarations for future engines, not permission to run those engines.

## Validation evidence

- v0.4 validation remains available in the merged PR #6 history: CI #82 and CodeQL #10 both passed.
- v0.5 TypeScript typecheck, unit tests, PostgreSQL integration tests, build and CodeQL are pending on this branch.
- The editing environment can update GitHub through the connected repository integration but does not execute the project locally. Any successful validation will be attributed to the exact GitHub Actions commit/run.

## Remaining platform work

- Browser discovery and Playwright target execution.
- External API contract/authorization test engine.
- WebSocket/Socket.IO target testing.
- k6 load testing and performance evidence.
- Secure target onboarding, authorization records, allowlists, SSRF/DNS/redirect protections and isolated workloads.
- Queue scalability (Redis/BullMQ) beyond the current PostgreSQL queue.
- Job cancellation, progress events, worker watchdogs and operator kill switch.
- Evidence storage, redaction/retention, reports and review workflows.
- Password reset, email verification, rate limits, MFA, organization invitations and audit events.
- Production deployment, operational monitoring, backups and recovery validation.
- `pnpm-lock.yaml` is still absent; CI continues to use `pnpm install --no-frozen-lockfile` until a real lockfile is generated and reviewed.

## Maturity policy

- **Prototype:** thin slices work in controlled local environments.
- **MVP:** a complete user journey works end-to-end on at least two unrelated authorized products with reproducible evidence and tested tenant isolation.
- **Production:** all security, reliability, observability, recovery, load, deployment and operational gates in [RELEASE_READINESS.md](RELEASE_READINESS.md) are met.

## Completion policy

A feature is complete only when implementation exists, its relevant automated test executes, the result is visible in CI, and docs accurately describe its limits. Never promote planned configuration into an implemented feature by adding environment variables alone.
