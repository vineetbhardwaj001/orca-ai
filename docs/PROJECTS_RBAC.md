# Projects API and organization access

## Endpoints

All routes require a valid ORCA session cookie.

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/v1/organizations/:organizationId/projects` | Active member | List active projects |
| POST | `/api/v1/organizations/:organizationId/projects` | Owner, Admin, Member | Create project |
| GET | `/api/v1/organizations/:organizationId/projects/:projectId` | Active member | Read one project |
| PATCH | `/api/v1/organizations/:organizationId/projects/:projectId` | Owner, Admin, Member | Update name/description |
| POST | `/api/v1/organizations/:organizationId/projects/:projectId/archive` | Owner, Admin | Archive project (soft delete) |

## Tenant isolation

Every project query binds both `organization_id` and the authenticated user's active membership. Create/update/archive statements enforce membership and role in the SQL statement itself, rather than relying on a UI check or a prior unprotected lookup. Cross-organization project IDs are not returned as accessible resources.

## Roles

- Owner: read, create, update, archive.
- Admin: read, create, update, archive.
- Member: read, create, update.
- Viewer: read only.

## Apply migrations

Apply migrations in order:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0001_identity_tenancy.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0002_project_lifecycle.sql
```

## Notes

- Archiving is reversible at the database level but no restore endpoint is exposed yet.
- Project deletion is deliberately not hard delete; evidence and test history must remain referentially safe.
- Organization management/invitations and a full audit log are later work.
