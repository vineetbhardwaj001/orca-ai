# ORCA Logical Database Schema

Implement with versioned migrations using PostgreSQL and Prisma or Drizzle. This is the logical model, not a substitute for migration tests.

## Identity and tenancy
- users(id UUID PK, email unique, password_hash, display_name, status, created_at, updated_at)
- organizations(id UUID PK, name, slug unique, settings JSONB, created_at, updated_at)
- organization_members(organization_id FK, user_id FK, role, created_at, UNIQUE organization_id/user_id)

## Projects and product discovery
- projects(id UUID PK, organization_id FK, name, description, status, created_by FK, created_at, updated_at)
- connectors(id UUID PK, project_id FK, type, encrypted_config_reference, status, created_at, updated_at)
- targets(id UUID PK, project_id FK, connector_id FK, target_type, base_url, authorization_state, allowlist JSONB, environment, created_at)
- product_profiles(id UUID PK, project_id FK, version, status, profile_json JSONB, discovered_at, UNIQUE project_id/version)
- discovered_pages(id UUID PK, profile_id FK, normalized_url, title, page_type, discovery_method, confidence, evidence_id FK nullable)
- discovered_features(id UUID PK, profile_id FK, feature_key, name, category, confidence, verification_state, evidence_id FK nullable)

## Plans and execution
- test_plans(id UUID PK, project_id FK, profile_id FK, version, status, created_at, approved_at)
- test_scenarios(id UUID PK, plan_id FK, scenario_key, title, category, priority, preconditions JSONB, steps JSONB, assertions JSONB, execution_engine, UNIQUE plan_id/scenario_key)
- test_runs(id UUID PK, project_id FK, plan_id FK, status, execution_mode, configuration JSONB, started_at, finished_at)
- test_executions(id UUID PK, run_id FK, scenario_id FK, worker_id FK nullable, status, attempt, idempotency_key, started_at, finished_at)
- test_results(id UUID PK, execution_id FK, outcome, expected JSONB, actual JSONB, error_code, summary, created_at)

## Workers and agents
- workers(id UUID PK, organization_id FK, external_worker_id unique, name, status, capabilities JSONB, last_heartbeat_at, revoked_at)
- worker_leases(id UUID PK, worker_id FK, run_id FK, execution_id FK nullable, lease_expires_at, status)
- agent_runs(id UUID PK, run_id FK, agent_type, provider, model, model_revision, status, input_reference, output_reference, started_at, finished_at)
- virtual_user_profiles(id UUID PK, project_id FK, name, persona JSONB, journey_config JSONB, created_at)

## Findings, evidence and reporting
- bug_reports(id UUID PK, project_id FK, result_id FK nullable, title, severity, status, reproduction JSONB, created_at, updated_at)
- evidence_files(id UUID PK, project_id FK, execution_id FK, storage_key, content_type, byte_size, checksum, redaction_status, created_at)
- review_decisions(id UUID PK, bug_id FK, reviewer_type, decision, notes, created_at)
- performance_metrics(id UUID PK, run_id FK, execution_id FK nullable, metric_name, metric_value, unit, dimensions JSONB, measured_at)
- reports(id UUID PK, run_id FK, format, storage_key, generated_at)
- audit_logs(id UUID PK, organization_id FK, actor_type, actor_id, action, resource_type, resource_id, metadata JSONB, created_at)

## Integrity and privacy
- Include organization ownership on project-scoped records where it improves authorization and query safety.
- Enforce tenant isolation in service queries and consider PostgreSQL RLS as defense in depth.
- Index foreign keys and common filters; use unique idempotency keys for dispatch.
- Finalized executions are immutable; later judgments are review records.
- Connector secrets are references to encrypted secret storage, never plaintext JSON.
- Define evidence retention, deletion, access and export policies.
