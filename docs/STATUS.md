# ORCA AI — Current Engineering Status

Last verified: 2026-11-04  
Repository version: 0.2.0-alpha.1 (proposed on the repository-readiness branch; not a tagged release)  
Default branch: main

## GitHub state at audit time

- PR #3 (identity, tenancy and project RBAC) is **merged**.
- Current main HEAD: baa09c6a18ce4322b5da15bb10e18d0f5b6dbb3b.
- CI run #61 on that merge commit completed successfully (typecheck, tests and build).
- Repository-readiness work is being prepared on feat/repository-readiness-v0.2.0-alpha.1; it is not part of main until its PR is reviewed and merged.
- No production deployment or end-to-end product test is claimed.

## Implemented

### Repository foundation
- pnpm/Turborepo workspace.
- React/Vite dashboard shell, Express API shell and worker bootstrap.
- Docker Compose with PostgreSQL and Redis services.
- GitHub Actions CI for workspace typecheck, tests and build.
- Shared Zod contracts and an OpenAI-compatible model provider abstraction.

### Identity and tenancy API
- PostgreSQL tables/migrations for users, organizations, memberships, projects and sessions.
- Registration creates a user, organization and owner membership in a transaction.
- Scrypt password hashing with random per-password salts.
- Opaque HttpOnly session cookie; only a SHA-256 token hash is persisted.
- Login, logout and current-user/organization-membership routes.

### Project management API
- Organization-scoped project list, create, read, update and archive endpoints.
- Active organization membership required for access.
- Owner/Admin/Member may create and update; Owner/Admin may archive.
- Project archive is a soft state transition.
- Unit tests cover password hashing and role-policy helpers.

## Current limitations / not yet proven

- pnpm-lock.yaml is absent; dependency resolution is not yet frozen/reproducible.
- No PostgreSQL-backed integration tests for registration, login, CRUD, role enforcement or cross-tenant isolation.
- Dashboard signup/login/project screens are not yet connected to the API.
- Organization invitations, membership management and audit events are not implemented.
- Rate limiting, password reset, email verification, MFA, session rotation and complete CSRF strategy are outstanding.
- Worker is bootstrap-only; authenticated enrollment, heartbeat, revocation, job leases and execution are absent.
- Browser discovery, API execution, realtime testing, k6 performance runs, accessibility/security engines and evidence reports are not implemented.
- Model gateway is not yet connected to discovery/planning/triage workflows.
- Production secrets management, structured observability, backup/restore drills, deployment hardening and operational runbooks are outstanding.

## Version and maturity policy

- 0.2.0-alpha.1 is a development baseline, not an MVP product release.
- **Prototype** means the architecture and thin vertical slices can be exercised in controlled local environments.
- **MVP** means a complete user journey works end-to-end on at least two unrelated authorized products, with reproducible evidence and tested tenant isolation.
- **Production** requires security, reliability, observability, recovery, load and deployment exit criteria documented in [release readiness](RELEASE_READINESS.md).

## Next milestone order

1. Add a committed pnpm lockfile and use frozen installs.
2. Add PostgreSQL-backed API integration tests, including cross-tenant denial and role enforcement.
3. Connect dashboard signup/login and project list/create/detail to real APIs.
4. Add typed environment validation and centralized structured logging.
5. Implement authenticated worker enrollment, heartbeat, revocation and persisted job round trip.
6. Implement target authorization/SSRF controls before connecting browser or load engines.
7. Build discovery + browser/API deterministic execution with evidence artifacts.
8. Add realtime/performance/security/accessibility engines and model-assisted planning only after deterministic execution boundaries exist.

## Completion policy

A feature is complete only when implementation exists, the relevant automated test executes, its result is visible in CI, and documentation accurately describes its limits. Do not promote planned configuration into an implemented feature by adding environment variables alone.
