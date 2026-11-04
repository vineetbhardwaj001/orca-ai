# Changelog

All notable repository changes are recorded here. Versions remain pre-release until explicitly tagged from main.

## 0.4.0-alpha.1 — 2026-11-04 (dashboard and application integration)

- Added Zod-validated API runtime configuration with fail-fast startup for missing or invalid database/origin/port/pool settings.
- Added request IDs, X-Request-Id response headers and structured request logs containing metadata only; request bodies, query strings, cookies and authorization headers are intentionally excluded.
- Added a typed dashboard API client with cookie credentials, cancellation, consistent API errors and Zod response validation.
- Connected dashboard registration, login, session restoration and logout to the existing API.
- Connected organization membership context and project list/create/read/update/archive screens to the existing tenant-scoped endpoints.
- Added role-aware project controls while retaining server-side authorization as the security boundary.
- Added Vite same-origin API proxying for local development.
- Added Playwright end-to-end coverage for registration, project lifecycle, logout and login; CI provisions an isolated PostgreSQL database and runs the browser journey.
- Added environment validation, request logging and dashboard API client unit tests.
- Corrected the engineering status record for merged PR #5 and added migration/rollback guidance.

Validation is pending the v0.4 feature-branch CI and CodeQL runs. The pnpm lockfile remains outstanding because no trustworthy generated lockfile was available in the editing environment; installs therefore remain non-frozen. This milestone does not implement browser/API/realtime/load execution engines, worker enrollment or production readiness.

## 0.3.0-alpha.1 — 2026-11-04 (control-plane verification)

- Extracted Express application construction into a reusable app factory for integration testing.
- Added graceful API shutdown and PostgreSQL pool cleanup.
- Hardened registration's database connection/transaction cleanup.
- Added PostgreSQL 16-backed API integration tests for identity, session revocation, tenant isolation and project role permissions.
- Updated GitHub CI to provision an isolated test database and execute the DB integration suite.
- Configured Turbo to pass TEST_DATABASE_URL and REQUIRE_DB_INTEGRATION into the test task; CI fails instead of silently skipping DB tests.
- Added a disposable test database environment template and local test instructions.
- Aligned root and workspace package metadata to 0.3.0-alpha.1.

Validation: PR #5 CI run #71 passed install, typecheck, unit + PostgreSQL integration tests and build. CodeQL run #4 passed. These checks validate this repository commit; they do not establish production readiness or prove the not-yet-implemented ORCA product test engines.

## 0.2.0-alpha.1 — 2026-11-04 (repository-readiness milestone)

- Reworked README with project overview, architecture, maturity status, quick start and API inventory.
- Added MIT license and contributor/security/PR guidance.
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
