# Identity and tenancy slice

This slice introduces the first persistent identity boundary for ORCA.

## Implemented

- PostgreSQL-backed users, organizations, memberships, projects, and sessions.
- Registration creates a user, a first organization, and an `owner` membership in one database transaction.
- Email is normalized to lowercase and protected by a case-insensitive unique index.
- Passwords are hashed with Node.js scrypt using a per-password random salt.
- Login creates a random opaque session token. Only its SHA-256 hash is stored in PostgreSQL.
- Session cookie is HttpOnly, SameSite=Lax, scoped to `/`, and Secure in production.
- Logout revokes the server-side session; `GET /api/v1/auth/me` returns the signed-in user and active organization memberships.
- Browser mutation requests with an Origin header must match `WEB_BASE_URL`.
- Validation and authentication errors use stable error codes; internal errors are not returned to clients.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create account + organization + owner membership |
| POST | `/api/v1/auth/login` | Authenticate and issue session cookie |
| POST | `/api/v1/auth/logout` | Revoke current session |
| GET | `/api/v1/auth/me` | Read current identity and organization memberships |

Registration body:

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "password": "at-least-12-characters",
  "organizationName": "Example Workspace"
}
```

## Local setup

1. Start services: `docker compose up -d postgres redis`.
2. Copy `.env.example` to `.env` and verify `DATABASE_URL`.
3. Apply the initial migration: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0001_identity_tenancy.sql`.
4. Install workspace dependencies: `pnpm install`.
5. Start the API: `pnpm --filter @orca/api dev`.

## Security and scope notes

- This is an initial identity foundation, not a production-ready authentication certification.
- Email verification, password reset, MFA, session rotation, rate limiting, bot protection, audit events, and account recovery are not implemented yet.
- Add CSRF tokens before introducing cross-site cookie use or broadening allowed origins. Keep the exact-origin check and SameSite cookie policy.
- The API currently has no organization/project CRUD endpoints. Every future query must derive organization access from the authenticated user's active membership and scope project reads/writes by organization ID.
- Never trust an organization ID supplied by a browser without checking membership and role on the server.
- Expired session cleanup should be scheduled after the worker/queue lifecycle is established.
- Do not use this endpoint as an invitation flow; membership invitations require separate expiring, single-use tokens.
