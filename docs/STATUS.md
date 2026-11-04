# ORCA — Current Engineering Status

Last updated: 2026-11-04

## Repository state

- Working branch: `feat/qa-lab-foundation`
- Default branch: `main`
- Latest verified branch commit: `c7cd0a59c44a706008127d0539ca787d1176cde6`
- Comparison with main: 25 commits ahead, 2 commits behind; Git reports the refs as diverged.
- No changes were pushed to `main`.
- The branch has not been rebased or force-pushed. Reconcile the two commits from main before proposing a merge.
- The GitHub status/check endpoint returned no status entries for the latest commit during this update. CI is therefore unverified, not passed.

## Implemented on the feature branch

### Platform foundation
- React/Vite dashboard shell, Express API shell, worker bootstrap, shared Zod contracts.
- Docker Compose for local PostgreSQL and Redis.
- CI workflow definition.

### Identity and tenancy foundation
- PostgreSQL users, organizations, organization memberships, projects and sessions.
- Registration creates user + organization + owner membership.
- Scrypt password hashing with random salts.
- Opaque session cookies; only SHA-256 token hashes are persisted.
- Login, logout and current-user/organization-membership endpoints.

### Project management foundation
- Organization-scoped project list, create, read, update and archive endpoints.
- Role policy: Owner/Admin/Member can create and update; Owner/Admin can archive; all active roles can read.
- SQL operations bind organization, authenticated user, active membership and required role.
- Archiving is soft state, not destructive deletion.
- Unit tests cover password hashing and the project role-policy helpers.

## Not yet proven

- Latest CI run and full workspace typecheck/test/build.
- PostgreSQL-backed integration tests for registration, login, project CRUD and cross-tenant denial.
- Frontend signup/login/project screens wired to these APIs.
- Organization invitations and membership administration.
- Rate limiting, email verification, password reset, MFA, session rotation and full CSRF hardening.
- Authenticated local worker enrollment, heartbeat, revocation and persisted echo job.
- Product discovery, browser/API/realtime/load test engines.

## Required next actions

1. Reconcile the 2 commits present on main without losing feature-branch work.
2. Run CI and add database-backed API integration tests using isolated test databases.
3. Integrate dashboard signup/login and project selection/creation/list/detail.
4. Complete organization membership administration and audit events.
5. Implement secure local-worker enrollment and a persisted echo-job round trip.

## Completion policy

A feature is not called complete because its files exist. Mark it tested only after the corresponding test executes and its output is recorded. Never claim a green CI run when GitHub reports no check result.
