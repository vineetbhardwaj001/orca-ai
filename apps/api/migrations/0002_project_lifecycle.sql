ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active';

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'archived'));

CREATE INDEX IF NOT EXISTS projects_org_status_created_idx
  ON projects (organization_id, status, created_at DESC);
