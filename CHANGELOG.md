# Changelog

All notable repository changes are recorded here. Versions remain pre-release until explicitly tagged from main.

## 0.5.0-alpha.1 — 2026-11-04 (secure worker enrollment and job execution)

- Added migration 0003 for one-time worker enrollment hashes, organization-bound worker identities, persisted echo jobs and lease history.
- Added owner/admin APIs to issue and revoke unclaimed enrollment tokens, list/revoke workers and enqueue idempotent echo jobs.
- Added one-use 15-minute enrollment and 30-day worker credentials. Only SHA-256 token hashes are stored.
- Added bearer-authenticated worker heartbeats and server-authorized capability binding.
- Added organization-scoped, capability-filtered job claims using PostgreSQL row locking and SKIP LOCKED.
- Added 60-second leases, three-attempt recovery for expired leases, lease history and lease-token-protected completion.
- Added immediate worker credential revocation and active-lease invalidation/requeue behavior.
- Replaced the worker bootstrap with an HTTP worker client, protected local credential file and deterministic echo-job executor.
- Added unit tests for token and credential-file safety and worker echo validation.
- Extended PostgreSQL integration tests for enrollment, credential hashing, early enrollment-token revocation, heartbeat, end-to-end echo execution, idempotency, tenant isolation, capability restrictions, lease recovery and worker revocation.
- Updated worker protocol, database schema, migration/rollback, security, environment and operator setup documentation.

Validation: source commit `291a23737bff6a47f286410b87f15372ed2bffbc` passed all-workspace typecheck, unit tests, PostgreSQL integration tests, build and the Playwright browser journey in CI run #89 (https://github.com/vineetbhardwaj001/orca-ai/actions/runs/41858675755); CodeQL run #13 passed (https://github.com/vineetbhardwaj001/orca-ai/actions/runs/41858675266). A docs-only follow-up records the run evidence and receives its own CI/CodeQL validation. Scope is limited to the echo job; no shell, arbitrary script, browser, external target API, repository or load execution is enabled. The v0.5 package version is 0.5.0-alpha.1. The pnpm lockfile remains outstanding, and CI retains non-frozen dependency installation until a genuine reviewed lockfile is available.

## 0.4.0-alpha.1 — 2026-11-04 (dashboard and application integration)

- Added Zod-validated API runtime configuration with fail-fast startup for missing or invalid database/origin/port/pool settings; production requires HTTPS and verified database TLS.
- Added request IDs, X-Request-Id response headers and structured request logs containing metadata only; request bodies, query strings, cookies and authorization headers are intentionally excluded.
- Added a typed dashboard API client with cookie credentials, cancellation, consistent API errors and Zod response validation.
- Connected dashboard registration, login, session restoration and logout to the existing API.
- Connected organization membership context and project list/create/read/update/archive screens to the existing tenant-scoped endpoints.
- Added role-aware project controls while retaining server-side authorization as the security boundary.
- Added Vite same-origin API proxying for local development.
- Added Playwright end-to-end coverage for registration, project lifecycle, logout and login; CI provisions an isolated PostgreSQL database and runs the browser journey.
- Added environment validation, request logging and dashboard API client unit tests; separated Vitest and Playwright scopes.
- Fixed the archive response DTO to return all fields expected by the shared project contract.
- Corrected the engineering status record for merged PR #5 and added migration/rollback guidance.

Validation: PR #6 feature-branch CI run #82 passed installation, all-workspace typecheck, unit + PostgreSQL integration tests, build and the Playwright browser journey. CodeQL run #10 passed. PR #6 has since merged to main.

The pnpm lockfile remains outstanding because no trustworthy generated lockfile was available in the editing environment; installs therefore remain non-frozen. This milestone does not implement browser/API/realtime/load execution engines, worker enrollment or production readiness.

## 0.3.0-alpha.1 — 2026-11-04 (control-plane verification)

- Extracted Express application construction into a reusable app factory for integration testing.
- Added graceful API shutdown and PostgreSQL pool cleanup.
- Hardened registration's database connection/transaction cleanup.
- Added PostgreSQL 16-backed API integration tests for identity, session revocation, tenant isolation and project role permissions.
- Updated GitHub CI to provision an isolated test database and execute the DB integration suite.
- Configured Turbo to pass TEST_DATABASE_URL and REQUIRE_DB_INTEGRATION into the test task; CI fails instead of silently skipping DB tests.
- Added a disposable test database environment template and local test instructions.
- Aligned root and workspace package metadata to 0.3.0-alpha.1.

Validation: PR #5 CI run #71 passed install, typecheck, unit + PostgreSQL integration tests and build. CodeQL run #4 passed.

## 0.2.0-alpha.1 — 2026-11-04 (repository-readiness milestone)

- Reworked README with project overview, architecture, maturity status, quick start and API inventory.
- Added MIT license and contributor/security/PR templates.
- Added MVP, prototype and production env templates.
- Documented repository structure, scaling, code-quality rules and release-readiness documentation.
- Added GitHub workflow guide and CodeQL analysis.
- Aligned workspace package metadata to 0.2.0-alpha.1.

## 0.1.0 — 2026-11-04 (identity and project-management foundation)

- Added PostgreSQL identity/organization/session schema and project lifecycle migration.
- Added registration, login, logout and current-user endpoints.
- Added scrypt password hashing and hashed opaque session persistence.
- Added organization-scoped project list/create/read/update/archive endpoints.
- Added role policy tests and setup/security documentation.
