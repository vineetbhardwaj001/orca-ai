# ORCA AI

**ORCA = Omni-purpose Reliability, Coverage & Assurance.**  
**Product:** Universal Autonomous QA Lab.

ORCA is a hybrid autonomous quality platform for authorized websites, web apps, APIs, real-time products and GitHub repositories. It combines deterministic test engines with AI-assisted discovery, planning, exploration and review.

## V1 product scope
- User lifecycle: signup, login, logout, session expiry/refresh, profile view/update and role/tenant isolation.
- UI behavior: buttons, links, menus, forms, navigation, CRUD, search, uploads, responsive and accessibility checks.
- API: schema, auth, validation, negative cases and response-time percentiles.
- Real-time: WebSocket/Socket.IO events, stream timing, reconnects and end-to-end feedback latency.
- Performance: controlled k6 profiles up to 100 synthetic virtual users (not 100 LLM agents).
- Product connectors: website, OpenAPI/Postman, GitHub and local worker.
- Modes: deterministic, autonomous, or both.
- Native Android/iOS testing is deferred to V2.

## Architecture
- **Cloud control plane:** React + Vite + TypeScript + SCSS; Node.js + Express; PostgreSQL; Redis + BullMQ; Socket.IO; object storage.
- **Execution plane:** isolated cloud workers and user-enrolled local workers, running Playwright, API, WebSocket and k6 engines.
- **AI layer:** OpenClaw adapter + provider-neutral model gateway. AI proposes and investigates; deterministic assertions decide outcomes.
- **Model strategy:** free/open-weight-first evaluation; small local model baseline, optional hosted free quotas, deterministic fallback.

## Quick start (foundation)
Requirements: Node.js 22+, pnpm 9+, Docker Desktop.

```powershell
corepack enable
pnpm install
docker compose up -d
pnpm dev
```

The repository now includes an initial PostgreSQL-backed identity layer (register/login/logout/current-user) and organization-scoped project APIs with role checks. These are implementation foundations, not yet a production authentication release: rate limiting, email verification, password reset, MFA, full CSRF strategy, and database-backed integration tests remain outstanding. Worker enrollment and actual product test execution are not implemented yet. Do not treat a scaffold screen as a completed feature.

## API quick start

Apply the migrations in order after starting PostgreSQL:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0001_identity_tenancy.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0002_project_lifecycle.sql
pnpm --filter @orca/api dev
```

Identity routes:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Organization project routes:
- `GET /api/v1/organizations/:organizationId/projects`
- `POST /api/v1/organizations/:organizationId/projects`
- `GET /api/v1/organizations/:organizationId/projects/:projectId`
- `PATCH /api/v1/organizations/:organizationId/projects/:projectId`
- `POST /api/v1/organizations/:organizationId/projects/:projectId/archive`

## Documentation
- [Master roadmap](docs/MASTER_ROADMAP.md)
- [Model evaluation strategy](docs/MODEL_STRATEGY.md)
- [Repository structure](docs/REPOSITORY_STRUCTURE.md)
- [Test coverage matrix](docs/TEST_COVERAGE_MATRIX.md)
- [OpenClaw integration boundary](integrations/openclaw/README.md)
- [Model evaluation strategy](docs/MODEL_STRATEGY.md)
- [Target repository structure](docs/REPOSITORY_STRUCTURE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [API contracts](docs/API_CONTRACTS.md)
- [Worker protocol](docs/WORKER_PROTOCOL.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Implementation milestones](docs/IMPLEMENTATION_ROADMAP.md)

## Development workflow
- Work on feature branches; never push directly to main.
- Add migrations, contracts and tests with each feature.
- Run typecheck, lint, tests and build before creating a PR.
- Mark functionality complete only after execution and evidence.
- Never store secrets in Git.
