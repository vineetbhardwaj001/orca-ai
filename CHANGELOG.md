# Changelog

All notable repository changes are recorded here. Versions remain pre-release until explicitly tagged from main.

## 0.3.0-alpha.1 — 2026-11-04 (control-plane verification)

- Extracted Express application construction into a reusable app factory for integration testing.
- Added graceful API shutdown and PostgreSQL pool cleanup.
- Added PostgreSQL 16-backed API integration tests for identity, session revocation, tenant isolation and project role permissions.
- Updated GitHub CI to provision an isolated test database and execute the DB integration suite.
- Configured Turbo to pass TEST_DATABASE_URL into the test task.
- Added a dedicated disposable test database environment template and local test instructions.
- Aligned root and workspace package metadata to 0.3.0-alpha.1.

Validation note: automated tests are authored in this branch. Their result is pending the pull-request workflow; do not describe DB integration as green until the run completes.

## 0.2.0-alpha.1 — 2026-11-04 (repository-readiness milestone)

- Reworked README with project overview, architecture, maturity status, quick start and API inventory.
- Added MIT license and contributor/security/PR guidance.
- Added MVP, prototype and production env templates.
- Documented repository structure, scaling, code-quality rules and production release gates.
- Added GitHub workflow guide and CodeQL analysis.
- Aligned workspace package metadata to 0.2.0-alpha.1.

## 0.1.0 — 2026-11-04 (identity and project-management foundation)

- Added PostgreSQL identity/organization/session schema and project lifecycle migration.
- Added registration, login, logout and current-user endpoints.
- Added scrypt password hashing and hashed opaque session persistence.
- Added organization-scoped project list/create/read/update/archive endpoints.
- Added role policy tests and setup/security documentation.
