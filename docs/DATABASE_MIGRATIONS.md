# Database Migrations and Rollback

ORCA currently uses ordered PostgreSQL SQL files. A migration runner and migration-history table have not yet been introduced. Apply each file exactly once, in numeric order, and stop immediately if `psql` reports an error.

## Before applying migrations

1. Confirm the target database name and environment.
2. Use a dedicated database role with only the required schema permissions.
3. Take a verified backup before changing staging or production data.
4. Do not run the integration-test suite against a development, staging or production database.
5. Set `ON_ERROR_STOP=1` so a failed statement does not leave the deployment script continuing silently.

## Apply current migrations

~~~bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0001_identity_tenancy.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0002_project_lifecycle.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0003_secure_workers_and_jobs.sql
~~~

The files create identity/organization/session data, the project lifecycle state, then one-time worker enrollment tokens, organization-bound workers, persisted echo jobs and lease history. Migration 0003 also adds composite uniqueness and foreign keys so worker jobs, projects and workers must share the same organization.

The SQL uses `IF NOT EXISTS` guards for supported repeated object creation, but this is not a replacement for migration version tracking.

## Rollback notes

Rollback is intentionally manual in this milestone. Review the target environment, obtain an approved backup/restore plan and confirm that data loss is acceptable before executing any rollback.

### Roll back migration 0003

This removes worker identities, enrollment tokens, queued jobs, results and lease history. Stop workers first and confirm that all v0.5 job history may be discarded.

~~~sql
DROP TABLE IF EXISTS worker_job_leases;
DROP TABLE IF EXISTS worker_jobs;
DROP TABLE IF EXISTS workers;
DROP TABLE IF EXISTS worker_enrollment_tokens;
DROP INDEX IF EXISTS projects_id_organization_unique;
~~~

### Roll back migration 0002

This removes the project lifecycle status. It will discard the active/archive distinction and should only be used when the application version has also been rolled back to code that does not expect `projects.status`.

~~~sql
DROP INDEX IF EXISTS projects_org_status_created_idx;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects DROP COLUMN IF EXISTS status;
~~~

### Roll back migration 0001

This drops all identity and project data created by the initial schema. It is destructive and is not a routine production rollback. Prefer restoring a verified pre-migration backup.

~~~sql
DROP TABLE IF EXISTS auth_sessions, projects, organization_members, organizations, users CASCADE;
~~~

Execute the 0003 rollback before 0002 and 0001. Never run either block just to reset a developer database when a clean disposable database is safer and clearer.

## Test database isolation

The PostgreSQL integration suite requires `TEST_DATABASE_URL` to resolve to a database named exactly `orca_test`. It refuses to run destructive setup against another database. CI uses a separate `orca_e2e` database for browser journeys so the integration suite's truncation cannot erase the browser-test environment.

## Known limitation

There is no automated migration history, checksum validation, down-migration framework or zero-downtime schema deployment mechanism yet. These are required before production database operations are approved.
