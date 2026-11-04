# ORCA AI — Current Engineering Status

Last verified: 2026-11-04  
Repository version: 0.3.0-alpha.1 (pre-release; no stable tag created)  
Default branch: main

## GitHub state at audit time

- PR #3 (identity, tenancy and project RBAC) is merged.
- PR #4 (repository documentation, license, environment templates and GitHub workflow readiness) is merged.
- PR #5 (control-plane verification) is open as a draft and has not been merged.
- Current main HEAD: ea781a52320d26341328079bb347619416e6c6ca.
- PR #5 head: fe0bd3a37a317badfd7fcc7e3c54307e1db48b4e; branch is 2 commits ahead and 0 behind main.
- PR #5 CI run #69 completed successfully: install, typecheck, unit + PostgreSQL integration tests, and build.
- PR #5 CodeQL run #3 completed successfully.
- Main branch protection is not enabled yet.
- No production deployment or full ORCA product execution is claimed.

## Implemented and merged before this phase

### v0.1.0 — Identity and project-management foundation (PR #3)
- pnpm/Turborepo monorepo, React/Vite dashboard shell, Express API shell and worker bootstrap.
- Docker Compose development services for PostgreSQL and Redis.
- GitHub Actions CI and shared Zod contracts/model gateway abstraction.
- PostgreSQL identity/organization/session schema and project lifecycle migration.
- Registration, login, logout and current-user/organization-membership routes.
- Scrypt password hashing and opaque HttpOnly session cookies with hashed server-side token storage.
- Organization-scoped project list/create/read/update/archive endpoints.
- Server-side active membership and role checks.
- Unit tests for password hashing and RBAC helper functions.

### v0.2.0-alpha.1 — Repository readiness (PR #4)
- Professional README and API inventory.
- MIT license, contributor/security guidance and PR template.
- MVP, prototype and production environment templates.
- Repository structure, scalability and code-quality guidance.
- CI workflow hardening, CodeQL analysis and release-readiness documentation.
- Aligned root and workspace package versions.

## Implemented and verified in v0.3.0-alpha.1 branch (PR #5)

- Extracted Express app construction into createApp() so tests can start an isolated ephemeral HTTP server without binding the production API port.
- Added graceful SIGTERM/SIGINT shutdown and PostgreSQL pool cleanup in the server entry point.
- Hardened registration's database connection acquisition and transaction cleanup.
- Added PostgreSQL 16 integration tests using a disposable database named orca_test.
- Tests cover registration and owner membership, case-insensitive duplicate email, invalid login, authentication requirement, logout/session revocation, cross-tenant list/read/update/archive denial, and viewer/member/admin project permissions.
- Added a test database name guard and REQUIRE_DB_INTEGRATION fail-fast switch to avoid silently skipping database tests in CI.
- Updated CI to provision PostgreSQL 16, wait for service health, and run unit + DB integration tests.
- Configured Turbo to pass the integration-test environment variables to test tasks.
- Added a dedicated test environment template and updated README/environment/test-coverage docs.
- Aligned root and workspace package versions to 0.3.0-alpha.1.

## Validation evidence

- PR #5 CI run #69: **success** — install, TypeScript typecheck, unit + PostgreSQL integration tests, build.
- PR #5 CodeQL run #3: **success**.
- PostgreSQL integration tests executed in the GitHub Actions PostgreSQL 16 service; they were not run locally in this environment.
- No production deployment, live website test, worker execution or 100+ VU test is claimed.

## Remaining engineering gaps

- pnpm-lock.yaml is absent; CI still uses --no-frozen-lockfile.
- Typed runtime environment validation and centralized structured logging/credential redaction are not implemented.
- Dashboard signup/login/project screens are not connected to real APIs.
- Password reset, email verification, rate limits, MFA, session rotation, complete CSRF hardening, org invitations and audit events are outstanding.
- Worker remains bootstrap-only: enrollment, heartbeat, revocation, job leases and execution are absent.
- Explicit target authorization, allowlists, SSRF/DNS/redirect protections and workload isolation are outstanding.
- Browser discovery, deterministic browser/API execution, realtime/performance/accessibility/security engines, evidence capture and reports are not implemented.
- Model gateway is not connected to discovery/planning/triage workflows.
- Main branch protection is not enabled.

## Next phase — v0.4.0-alpha.1: Dashboard and application configuration

1. Commit a reviewed pnpm lockfile and switch CI/local setup to frozen installs.
2. Add typed Zod-based environment parsing for the API and fail fast on invalid production configuration.
3. Add structured request logging with request IDs and redaction for cookies, passwords, tokens and authorization headers.
4. Implement a typed dashboard API client with credentials, consistent errors, cancellation and runtime response validation.
5. Build signup, login, logout and current-session restoration against the existing API.
6. Build organization selection and project list/create/detail/update/archive screens using real endpoints and role-aware UI.
7. Add dashboard API contract tests and Playwright end-to-end journeys with PostgreSQL-backed CI.
8. Add migration and rollback documentation before expanding the domain model.

## Maturity policy

- 0.3.0-alpha.1 is a control-plane verification development baseline, not an MVP product release.
- **Prototype:** thin slices work in controlled local environments.
- **MVP:** a complete user journey works end-to-end on at least two unrelated authorized products with reproducible evidence and tested tenant isolation.
- **Production:** all security, reliability, observability, recovery, load, deployment and operational gates in [RELEASE_READINESS.md](RELEASE_READINESS.md) are met.

## Completion policy

A feature is complete only when implementation exists, its relevant automated test executes, the result is visible in CI, and docs accurately describe its limits. Never promote planned configuration into an implemented feature by adding environment variables alone.
