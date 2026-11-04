-- Authenticated organization workers and a deliberately narrow echo-job
-- execution path. This schema does not grant shell, browser or arbitrary
-- network execution to enrolled workers.

CREATE UNIQUE INDEX IF NOT EXISTS projects_id_organization_unique
  ON projects (id, organization_id);

CREATE TABLE IF NOT EXISTS worker_enrollment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  capabilities text[] NOT NULL CHECK (cardinality(capabilities) > 0),
  created_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS worker_enrollment_org_created_idx
  ON worker_enrollment_tokens (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  capabilities text[] NOT NULL CHECK (cardinality(capabilities) > 0),
  credential_hash char(64) NOT NULL UNIQUE,
  credential_expires_at timestamptz NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'IDLE'
    CHECK (status IN ('IDLE', 'BUSY', 'DEGRADED')),
  version varchar(40),
  last_heartbeat_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)
);
CREATE INDEX IF NOT EXISTS workers_org_created_idx
  ON workers (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workers_heartbeat_idx
  ON workers (last_heartbeat_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS worker_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  job_type varchar(24) NOT NULL CHECK (job_type IN ('echo')),
  payload jsonb NOT NULL,
  required_capabilities text[] NOT NULL CHECK (cardinality(required_capabilities) > 0),
  idempotency_key varchar(200) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'succeeded', 'failed', 'cancelled')),
  assigned_worker_id uuid,
  lease_token_hash char(64),
  lease_expires_at timestamptz,
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
  result jsonb,
  error_code varchar(48),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT worker_jobs_idempotency_unique UNIQUE (organization_id, idempotency_key),
  CONSTRAINT worker_jobs_project_tenant_fk
    FOREIGN KEY (project_id, organization_id)
    REFERENCES projects(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT worker_jobs_worker_tenant_fk
    FOREIGN KEY (assigned_worker_id, organization_id)
    REFERENCES workers(id, organization_id),
  CONSTRAINT worker_jobs_lease_state_check CHECK (
    (status = 'leased' AND assigned_worker_id IS NOT NULL
      AND lease_token_hash IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'leased' AND assigned_worker_id IS NULL
      AND lease_token_hash IS NULL AND lease_expires_at IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS worker_jobs_queue_idx
  ON worker_jobs (organization_id, status, created_at)
  WHERE status IN ('queued', 'leased');
CREATE INDEX IF NOT EXISTS worker_jobs_assigned_worker_idx
  ON worker_jobs (assigned_worker_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS worker_jobs_id_organization_unique
  ON worker_jobs (id, organization_id);

CREATE TABLE IF NOT EXISTS worker_job_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  lease_token_hash char(64) NOT NULL UNIQUE,
  status varchar(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT worker_job_leases_job_tenant_fk
    FOREIGN KEY (job_id, organization_id)
    REFERENCES worker_jobs(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT worker_job_leases_worker_tenant_fk
    FOREIGN KEY (worker_id, organization_id)
    REFERENCES workers(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS worker_job_leases_active_idx
  ON worker_job_leases (worker_id, expires_at)
  WHERE status = 'active';

COMMENT ON TABLE worker_enrollment_tokens IS
  'One-time, short-lived enrollment token hashes. Plaintext is returned only when created.';
COMMENT ON TABLE workers IS
  'Organization-scoped workers. Only SHA-256 hashes of random bearer credentials are stored.';
COMMENT ON TABLE worker_jobs IS
  'Persisted, bounded job queue. v0.5 supports safe echo jobs only; no shell or arbitrary target execution.';
COMMENT ON TABLE worker_job_leases IS
  'Lease history. A lease token is returned once to its worker and only its hash is stored.';
