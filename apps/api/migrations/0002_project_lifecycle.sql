ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('active', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS projects_org_status_created_idx
  ON projects (organization_id, status, created_at DESC);
