# ORCA Logical Database Schema

This document describes the implemented identity and worker-control-plane tables plus planned future entities. The versioned SQL migrations are the authoritative schema for the running application.

## Identity and tenancy
- users(id UUID PK, email unique, password_hash, name, email_verified_at, created_at, updated_at)
- organizations(id UUID PK, name, slug unique, created_at, updated_at)
- organization_members(organization_id FK, user_id FK, role, status, created_at, UNIQUE organization_id/user_id)
- projects(id UUID PK, organization_id FK, name, description, status, created_by FK, created_at, updated_at)

## Sessions
- auth_sessions(id UUID PK, user_id FK, token_hash unique, expires_at, revoked_at, created_at)
- Session tokens are opaque random values. Only a SHA-256 digest is persisted.

## Worker enrollment and execution (v0.5)

- worker_enrollment_tokens(id UUID PK, organization_id FK, token_hash unique, capabilities TEXT[], created_by FK, expires_at, used_at, revoked_at, created_at)
- workers(id UUID PK, organization_id FK, name, capabilities TEXT[], credential_hash unique, credential_expires_at, status, version, last_heartbeat_at, revoked_at, created_at)
- worker_jobs(id UUID PK, organization_id FK, project_id composite FK, job_type, payload JSONB, required_capabilities TEXT[], idempotency_key, status, assigned_worker_id composite FK, lease_token_hash, lease_expires_at, attempt, max_attempts, result JSONB, error_code, timestamps)
- worker_job_leases(id UUID PK, organization_id FK, job_id composite FK, worker_id composite FK, lease_token_hash unique, status, expires_at, claimed_at, completed_at)

Enrollment tokens are one-use and expire after 15 minutes. Worker credentials expire after 30 days and can be revoked by organization owners/admins. The control plane stores hashes only, never plaintext enrollment, worker or lease tokens.

PostgreSQL row locks with `SKIP LOCKED` select jobs atomically. A 60-second lease prevents concurrent completion; expired work is requeued up to three attempts. The current executable job type is only `echo`.

## Authorized targets (v0.6)

- `authorized_targets(id UUID PK, organization_id FK, project_id composite FK, scheme, hostname, port, path_prefixes TEXT[], authorization_confirmed_by FK, authorization_confirmed_at, authorization_expires_at, verification_token_hash, status, dns_verified_at, verification_expires_at, resolved_addresses JSONB, revoked_at, created_by FK, created_at, updated_at)`

Targets are restricted to an exact HTTP(S) origin on ports 80/443 and up to fifty explicit path prefixes. Owner/admin attestation is time-bounded to at most ninety days. DNS control is a one-time TXT proof; only its SHA-256 hash is stored. Activation requires every A/AAAA answer to be globally routable. The recorded public address set is fresh for 24 hours; future network execution must re-resolve and pin the same approved address set before connecting. v0.6 performs no target HTTP requests or browser/API execution.

## Future project discovery and execution
- connectors(id UUID PK, project_id FK, type, encrypted_config_reference, status, created_at, updated_at)
- target discoveries, page profiles and test runs remain future entities; the implemented `authorized_targets` registry is described above.
- product_profiles(id UUID PK, project_id FK, version, status, profile_json JSONB, discovered_at, UNIQUE project_id/version)
- discovered_pages(id UUID PK, profile_id FK, normalized_url, title, page_type, discovery_method, confidence, evidence_id FK nullable)
- discovered_features(id UUID PK, profile_id FK, feature_key, name, category, confidence, verification_state, evidence_id FK nullable)
- test_plans(id UUID PK, project_id FK, profile_id FK, version, status, created_at, approved_at)
- test_scenarios(id UUID PK, plan_id FK, scenario_key, title, category, priority, preconditions JSONB, steps JSONB, assertions JSONB, execution_engine, UNIQUE plan_id/scenario_key)
- test_runs(id UUID PK, project_id FK, plan_id FK, status, execution_mode, configuration JSONB, started_at, finished_at)
- test_executions(id UUID PK, run_id FK, scenario_id FK, worker_id FK nullable, status, attempt, idempotency_key, started_at, finished_at)
- test_results(id UUID PK, execution_id FK, outcome, expected JSONB, actual JSONB, error_code, summary, created_at)

## Findings, evidence and reporting
- bug_reports(id UUID PK, project_id FK, result_id FK nullable, title, severity, status, reproduction JSONB, created_at, updated_at)
- evidence_files(id UUID PK, project_id FK, execution_id FK, storage_key, content_type, byte_size, checksum, redaction_status, created_at)
- review_decisions(id UUID PK, bug_id FK, reviewer_type, decision, notes, created_at)
- performance_metrics(id UUID PK, run_id FK, execution_id FK nullable, metric_name, metric_value, unit, dimensions JSONB, measured_at)
- reports(id UUID PK, run_id FK, format, storage_key, generated_at)
- audit_logs(id UUID PK, organization_id FK, actor_type, actor_id, action, resource_type, resource_id, metadata JSONB, created_at)

## Integrity and privacy

- Worker, job, project, lease and authorized-target rows include organization-consistency constraints.
- The worker queue has unique organization-scoped idempotency keys.
- Only hashes of enrollment, worker and lease credentials are persisted.
- The worker cannot add capabilities through heartbeat.
- Admin listing APIs omit credential hashes and raw tokens.
- Enforce tenant isolation in service queries and consider PostgreSQL RLS as defense in depth.
- Connector secrets are references to encrypted secret storage, never plaintext JSON.
- Define evidence retention, deletion, access and export policies before those features ship.
