# ORCA AI — Current Engineering Status

Last verified: 2026-11-04  
Repository version: 0.3.0-alpha.1 (proposed on the current feature branch; not a tagged release)  
Default branch: main

## GitHub state at audit time

- PR #4 (repository README, license, environment profiles and GitHub workflow readiness) is merged.
- Current main HEAD at phase start: ea781a52320d26341328079bb347619416e6c6ca.
- CI run #65 and CodeQL run #2 on the PR #4 merge commit completed successfully.
- Control-plane verification work is being prepared on feat/control-plane-verification-v0.3.0-alpha.1; it is not part of main until its PR is reviewed and merged.
- Main branch protection is not enabled yet.
- No production deployment or full product execution is claimed.

## Implemented before this phase

- pnpm/Turborepo monorepo, React/Vite dashboard shell, Express API shell and worker bootstrap.
- Docker Compose development services for PostgreSQL and Redis.
- GitHub Actions CI and CodeQL.
- Zod contracts and an OpenAI-compatible model provider abstraction.
- PostgreSQL identity/organization/session schema and project lifecycle migration.
- Registration, login, logout and current-user/organization-membership routes.
- Scrypt password hashing and opaque HttpOnly session cookies with hashed server-side token storage.
- Organization-scoped project list/create/read/update/archive endpoints.
- Server-side active membership and role checks.

## Added in 0.3.0-alpha.1 branch

- Extracted Express app construction into createApp() so tests can start an isolated ephemeral HTTP server without binding the production API port.
- Added graceful SIGTERM/SIGINT shutdown and PostgreSQL pool close in the server entry point.
- Added PostgreSQL integration suite against a disposable database named orca_test.
- Added tests for registration + owner membership, case-insensitive duplicate email, invalid login, logout revocation, cross-tenant list/read/update/archive protection and viewer/member/admin project permissions.
- Updated CI to provision PostgreSQL 16, wait for health, and run integration tests together with unit tests.
- Passed TEST_DATABASE_URL through the Turbo test task environment so integration tests execute under the monorepo runner.
- Added local test environment template and documented safe integration test setup.
- Bumped root and workspace package metadata to 0.3.0-alpha.1.

## Validation status

- This branch's CI and CodeQL are pending until GitHub Actions completes.
- Integration tests are authored but must not be called passing until the PostgreSQL workflow job completes.
- pnpm-lock.yaml is still absent; CI still uses --no-frozen-lockfile.
- Direct container clone/network access was unavailable during this run, so local test execution could not be performed here.

## Not yet implemented / next

1. Commit and validate a pnpm lockfile; switch CI to frozen installs.
2. Typed environment validation and structured logging with credential redaction.
3. Dashboard signup/login and project list/create/detail connected to the real API.
4. Password reset, email verification, rate limits, session rotation, CSRF hardening, org invitations and audit events.
5. Authenticated worker enrollment, heartbeat, revocation, job leases and a persisted echo-job round trip.
6. Explicit target allowlist and SSRF/DNS/redirect protections.
7. Browser discovery and deterministic browser/API execution with evidence storage.
8. Realtime/performance/accessibility/security engines and model-assisted planning.

## Maturity policy

- 0.3.0-alpha.1 is a control-plane verification development baseline, not an MVP product release.
- **Prototype:** thin slices work in controlled local environments.
- **MVP:** a complete user journey works end-to-end on at least two unrelated authorized products with reproducible evidence and tested tenant isolation.
- **Production:** all security, reliability, observability, recovery, load, deployment and operational gates in [RELEASE_READINESS.md](RELEASE_READINESS.md) are met.

## Completion policy

A feature is complete only when implementation exists, its relevant automated test executes, the result is visible in CI, and docs accurately describe its limits. Never promote planned configuration into an implemented feature by adding environment variables alone.
