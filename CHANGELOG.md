# Changelog

## 2026-11-04 — Identity, tenancy and project-management foundation

- Added PostgreSQL identity/organization/session schema and project lifecycle migration.
- Added registration, login, logout and current-user endpoints.
- Added scrypt password hashing and hashed opaque session persistence.
- Added organization-scoped project list/create/read/update/archive endpoints.
- Added role policy tests and setup/security documentation.
- Updated roadmap and README to distinguish implemented code from outstanding verification.

Validation note: latest feature-branch GitHub status endpoint returned no check entries; CI and database-backed authorization tests remain unverified.
