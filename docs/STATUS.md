# ORCA AI — Current Engineering Status

Last verified: 2026-11-04  
Target version on this feature branch: 0.4.0-alpha.1  
Current main baseline at branch creation: e494cf76de961246be267522bb84a6f92ee2144a  
Feature branch HEAD: ed792425950fbf877feca347217f04c596853ceb

## GitHub state at branch creation

- PR #3 (identity, tenancy and project RBAC) is merged.
- PR #4 (repository documentation, license, environment templates and GitHub workflow readiness) is merged.
- PR #5 (control-plane verification) is merged. It is not an open draft.
- Main CI run #72 succeeded: https://github.com/vineetbhardwaj001/orca-ai/actions/runs/41849784391
- Main CodeQL run #5 succeeded: https://github.com/vineetbhardwaj001/orca-ai/actions/runs/41849784579
- Main branch protection was not enabled at the last audit.
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
- MIT license, contributor/security/PR templates.
- MVP, prototype and production environment templates.
- Repository structure/scalability/engineering guidelines and release-readiness documentation.
- CI workflow hardening and CodeQL analysis.

### v0.3.0-alpha.1 — Control-plane verification (PR #5; merged)
- Extracted Express application construction into a reusable app factory.
- Added graceful SIGTERM/SIGINT shutdown and PostgreSQL pool cleanup.
- Hardened registration transaction cleanup.
- Added PostgreSQL 16 integration tests using a disposable database named orca_test.
- Verified registration, owner membership, duplicate email, invalid login, authentication requirement, logout/session revocation, cross-tenant access denial and viewer/member/admin project permissions.
- CI run #71 and CodeQL run #4 passed on the PR branch; main CI run #72 and CodeQL run #5 passed after merge.

## v0.4.0-alpha.1 — Dashboard and application integration

Implemented on feat/dashboard-app-integration-v0.4.0-alpha.1. Validation passed on feature branch HEAD ed792425950fbf877feca347217f04c596853ceb.

- Added Zod-validated runtime config for NODE_ENV, API_PORT, WEB_BASE_URL, DATABASE_URL, DATABASE_SSL and DB_POOL_MAX. Production requires HTTPS dashboard origin and verified database TLS.
- Added generated request IDs, X-Request-Id, structured request logs and metadata-only logging. Bodies, query strings, cookies and authorization headers are not logged.
- Added a typed dashboard API client with credentials include, abort-signal support, consistent typed errors and Zod response parsing.
- Connected signup, login, current-session restoration and logout to the existing session API.
- Connected org memberships and tenant-scoped project list/create/read/update/archive flows.
- Added role-aware UI: owner/admin/member can create or update; owner/admin can archive. The API remains the enforcement boundary.
- Added same-origin Vite proxy routes for /api and /health.
- Added Playwright coverage for registration → project create/read/update/archive → logout/login. CI provisions a separate orca_e2e database and runs the real browser journey.
- Added API config, request logging and dashboard API client unit tests.
- Separated Vitest unit tests from Playwright browser specs.
- Made the archive endpoint return the complete project DTO expected by the dashboard contract.
- Corrected prior PR #5 status and added migration/rollback notes.

### Remaining item in v0.4

- pnpm-lock.yaml remains absent. No lockfile was fabricated. CI still uses pnpm install --no-frozen-lockfile. Generate and review the lockfile in a network-enabled environment before switching to frozen installs.

## Validation evidence

- Feature branch CI run #81 passed: https://github.com/vineetbhardwaj001/orca-ai/actions/runs/41853874267
  - pnpm install
  - TypeScript typecheck across all five workspace packages
  - Unit tests and PostgreSQL-backed API integration tests
  - Build
  - Chromium install and isolated PostgreSQL end-to-end database setup
  - API/dashboard startup and Playwright registration/project lifecycle/logout/login journey
- Feature branch CodeQL run #9 passed: https://github.com/vineetbhardwaj001/orca-ai/actions/runs/41853874430
- The editing environment could access GitHub repository APIs but could not resolve github.com from a local shell; no local install/build/test result is claimed. The validation evidence above is from GitHub Actions.

## Current capability boundaries

### Available after v0.4 CI validation
- Create accounts and workspaces, sign in/out and restore a session through the real API.
- Load the authenticated user's active organization memberships.
- Create, list, read, update and archive organization-scoped projects.
- Enforce permissions server-side; the dashboard only adapts available controls to the active role.
- Run automated CI checks against API and dashboard workflows.

### Still not implemented
- Arbitrary website URL crawling, DOM discovery or Playwright target automation.
- API target discovery or external API testing engine.
- WebSocket/Socket.IO target testing engine.
- k6 virtual-user load execution.
- Autonomous AI QA workflows, bug/evidence/report generation.
- Worker enrollment, heartbeat, revocation, job leases and test execution.
- Target authorization, allowlists, SSRF/DNS/redirect protections and isolated workloads.
- Password reset, email verification, rate limiting, MFA, organization invitations and audit events.
- Production deployment, operational monitoring, backups and recovery validation.

## Maturity policy

- **Prototype:** thin slices work in controlled local environments.
- **MVP:** a complete user journey works end-to-end on at least two unrelated authorized products with reproducible evidence and tested tenant isolation.
- **Production:** all security, reliability, observability, recovery, load, deployment and operational gates in [RELEASE_READINESS.md](RELEASE_READINESS.md) are met.

## Completion policy

A feature is complete only when implementation exists, its relevant automated test executes, the result is visible in CI, and docs accurately describe its limits. Never promote planned configuration into an implemented feature by adding environment variables alone.
