# Changelog

All notable repository changes are recorded here. Versions remain pre-release until explicitly tagged from main.

## 0.2.0-alpha.1 — 2026-11-04 (repository-readiness milestone)

- Reworked README with project overview, architecture, maturity status, quick start, API inventory and docs.
- Added MIT license and contributor/security/PR guidance.
- Added MVP, prototype and production environment templates with implemented-versus-reserved variable notes.
- Documented actual vs target folder structure and incremental scaling/code-quality rules.
- Added GitHub workflow guide and CodeQL analysis workflow.
- Added branch/PR/production release readiness gates.
- Aligned root and workspace package version metadata to 0.2.0-alpha.1.

Validation note: this milestone changes docs, templates, metadata and GitHub workflows. It does not implement browser/API/realtime test execution or make the platform production-ready.

## 0.1.0 — 2026-11-04 (identity and project-management foundation)

- Added PostgreSQL identity/organization/session schema and project lifecycle migration.
- Added registration, login, logout and current-user endpoints.
- Added scrypt password hashing and hashed opaque session persistence.
- Added organization-scoped project list/create/read/update/archive endpoints.
- Added role policy tests and setup/security documentation.
