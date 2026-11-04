-- Organization/project-scoped target authorization and DNS ownership proof.
-- This migration only registers and verifies target scope. It does not enable
-- outbound HTTP requests or browser/API execution against registered targets.

CREATE TABLE IF NOT EXISTS authorized_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  scheme varchar(5) NOT NULL CHECK (scheme IN ('http', 'https')),
  hostname varchar(253) NOT NULL,
  port integer NOT NULL CHECK (port IN (80, 443)),
  path_prefixes text[] NOT NULL CHECK (cardinality(path_prefixes) BETWEEN 1 AND 50),
  authorization_confirmed_by uuid NOT NULL REFERENCES users(id),
  authorization_confirmed_at timestamptz NOT NULL DEFAULT now(),
  authorization_expires_at timestamptz NOT NULL,
  verification_token_hash char(64) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'active', 'revoked')),
  dns_verified_at timestamptz,
  verification_expires_at timestamptz,
  resolved_addresses jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(resolved_addresses) = 'array'),
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT authorized_targets_project_tenant_fk
    FOREIGN KEY (project_id, organization_id)
    REFERENCES projects(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT authorized_targets_auth_window_check
    CHECK (authorization_expires_at > authorization_confirmed_at),
  CONSTRAINT authorized_targets_scheme_port_check
    CHECK ((scheme = 'https' AND port = 443) OR (scheme = 'http' AND port = 80)),
  CONSTRAINT authorized_targets_hostname_check
    CHECK (hostname = lower(hostname) AND length(hostname) <= 240
      AND position('.' in hostname) > 1
      AND hostname !~ '(^|\\.)(localhost|local|internal|home|lan|test|invalid|example|onion|arpa)
  CONSTRAINT authorized_targets_active_dns_check
    CHECK (
      status <> 'active'
      OR (
        dns_verified_at IS NOT NULL
        AND verification_expires_at IS NOT NULL
        AND jsonb_array_length(resolved_addresses) > 0
      )
    ),
  CONSTRAINT authorized_targets_revoked_check
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL),
  UNIQUE (id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS authorized_targets_active_origin_unique
  ON authorized_targets (organization_id, project_id, scheme, hostname, port)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS authorized_targets_org_created_idx
  ON authorized_targets (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS authorized_targets_project_status_idx
  ON authorized_targets (project_id, status, verification_expires_at);
CREATE INDEX IF NOT EXISTS authorized_targets_dns_expiry_idx
  ON authorized_targets (verification_expires_at)
  WHERE status = 'active';

COMMENT ON TABLE authorized_targets IS
  'Explicitly authorized, project-scoped HTTP(S) origins. DNS TXT ownership proof and public-address validation are required before activation. Target execution is deliberately disabled in v0.6.';
COMMENT ON COLUMN authorized_targets.verification_token_hash IS
  'SHA-256 hash of the one-time DNS TXT challenge value; raw challenge is returned only once.';
COMMENT ON COLUMN authorized_targets.resolved_addresses IS
  'Public A/AAAA addresses observed at verification. A future executor must re-resolve and compare the complete set before every connection to prevent DNS rebinding.';
COMMENT ON COLUMN authorized_targets.verification_expires_at IS
  'DNS approval freshness window. Future target execution must reject expired DNS verification and revalidate/pin the resolved addresses.';
),
  CONSTRAINT authorized_targets_active_dns_check
    CHECK (
      status <> 'active'
      OR (
        dns_verified_at IS NOT NULL
        AND verification_expires_at IS NOT NULL
        AND jsonb_array_length(resolved_addresses) > 0
      )
    ),
  CONSTRAINT authorized_targets_revoked_check
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL),
  UNIQUE (id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS authorized_targets_active_origin_unique
  ON authorized_targets (organization_id, project_id, scheme, hostname, port)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS authorized_targets_org_created_idx
  ON authorized_targets (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS authorized_targets_project_status_idx
  ON authorized_targets (project_id, status, verification_expires_at);
CREATE INDEX IF NOT EXISTS authorized_targets_dns_expiry_idx
  ON authorized_targets (verification_expires_at)
  WHERE status = 'active';

COMMENT ON TABLE authorized_targets IS
  'Explicitly authorized, project-scoped HTTP(S) origins. DNS TXT ownership proof and public-address validation are required before activation. Target execution is deliberately disabled in v0.6.';
COMMENT ON COLUMN authorized_targets.verification_token_hash IS
  'SHA-256 hash of the one-time DNS TXT challenge value; raw challenge is returned only once.';
COMMENT ON COLUMN authorized_targets.resolved_addresses IS
  'Public A/AAAA addresses observed at verification. A future executor must re-resolve and compare the complete set before every connection to prevent DNS rebinding.';
COMMENT ON COLUMN authorized_targets.verification_expires_at IS
  'DNS approval freshness window. Future target execution must reject expired DNS verification and revalidate/pin the resolved addresses.';
