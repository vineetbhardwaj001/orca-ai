<div align="center">

# ORCA AI
**Omni-purpose Reliability, Coverage & Assurance**
*Universal Autonomous QA Lab*

[![ORCA CI](https://github.com/vineetbhardwaj001/orca-ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vineetbhardwaj001/orca-ai/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.4.0--alpha.1-orange)](CHANGELOG.md)
[![Stage](https://img.shields.io/badge/stage-dashboard--integration-blue)](docs/STATUS.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Test software like real users. Verify outcomes like an engineer.**
</div>

ORCA is being built as a universal quality-assurance platform for authorized websites, web applications, APIs, real-time systems and source-code repositories. It combines deterministic test engines with AI-assisted discovery, planning, exploration, bug investigation and evidence review.

> **Stage: dashboard and control-plane integration.** The API now has PostgreSQL-backed identity, sessions, organizations and project lifecycle endpoints. The React dashboard in this milestone connects signup, login, session restoration, organization context and project CRUD to those real endpoints. Browser/API/realtime/load execution, secure worker enrollment and production operations remain under development.

## Project status

| Area | Current state |
|---|---|
| Monorepo foundation | Implemented |
| Dashboard authentication | Integrated with real API |
| Organization context | Loaded from authenticated memberships |
| Project management | Real list, create, read, update and archive flows |
| API configuration | Zod validation; server fails fast on invalid/missing database configuration |
| API observability | Request IDs and structured metadata-only request logs |
| PostgreSQL migrations | Initial identity and project lifecycle schema |
| Automated verification | Unit tests, PostgreSQL integration tests and Playwright dashboard journey in CI |
| Model gateway | Provider abstraction; not wired into product workflows |
| Worker | Bootstrap only; execution disabled |
| Browser/API/realtime/performance engines | Planned; not implemented |
| Production operations and hardening | Not ready |

CI passing means the checks executed against that commit passed. It does not mean all planned ORCA capabilities are implemented or that the service is production-ready. See [engineering status](docs/STATUS.md).

## What ORCA is designed to test

- **Web journeys:** navigation, links, buttons, forms, validation, CRUD, search, uploads, responsive behavior and accessibility.
- **APIs:** OpenAPI contracts, authentication, authorization, validation, negative cases and latency.
- **Real-time systems:** WebSocket/Socket.IO events, ordering, reconnect behavior, streaming and end-to-end feedback timing.
- **Performance:** controlled k6 scenarios using deterministic virtual users—not one LLM agent per virtual user.
- **Repositories:** authorized source inspection, dependency/configuration review and evidence-backed findings.
- **AI-assisted QA:** discovery, test-plan suggestions, exploratory scenarios, bug triage and independent review.

These are product goals, not a claim that the corresponding engines already exist. All testing must be authorized, scope-limited and evidence-backed. Deterministic assertions—not model opinions—must decide pass/fail outcomes.

## Architecture

ORCA follows a **modular-monolith control plane with separately deployable execution workers**.

| Layer | Technology | Responsibility |
|---|---|---|
| Dashboard | React 18, Vite 6, TypeScript, SCSS | Authentication and project operations UI |
| API | Node.js 22+, Express 4, TypeScript | Identity, tenancy and control plane |
| Contracts | Zod | Runtime validation and shared DTOs |
| Persistence | PostgreSQL 16 | Users, organizations, memberships, projects and sessions |
| Queue (planned) | Redis 7, BullMQ | Job dispatch, retries and worker coordination |
| Realtime (planned) | Socket.IO | Authenticated run progress and worker events |
| Browser engine (planned) | Playwright | Discovery and real browser workflows |
| Performance engine (planned) | k6 | Controlled concurrent load |
| AI layer | Provider-neutral model gateway; optional OpenClaw adapter | Planning and investigation, never authorization or final verdicts |
| Runtime | Docker Compose locally | Reproducible development services |

See [architecture](docs/ARCHITECTURE.md), [security model](docs/SECURITY_MODEL.md) and [master roadmap](docs/MASTER_ROADMAP.md).

## Repository layout

~~~text
orca-ai/
├── apps/
│   ├── api/                 # Express API, configuration, migrations and DB tests
│   ├── dashboard/           # React + Vite + SCSS, API client and Playwright journey
│   └── worker/              # Worker bootstrap (execution not enabled)
├── packages/
│   ├── contracts/           # Shared Zod schemas
│   └── model-gateway/       # Provider-neutral model interface
├── integrations/openclaw/   # Optional orchestration boundary
├── docs/                    # Architecture, security, roadmap and status
├── env/                     # MVP, prototype, test and production templates
├── .github/workflows/       # CI and CodeQL
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
~~~

Future engines, agents and infrastructure packages are documented as extension points, not empty placeholder directories. Read [repository structure and scaling rules](docs/REPOSITORY_STRUCTURE.md).

## Quick start

Requirements: Node.js 22+, Corepack/pnpm 9.15.4, Docker Desktop/Engine and PostgreSQL client tools (psql).

~~~bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --no-frozen-lockfile
docker compose up -d postgres redis
~~~

Copy .env.example to .env and keep the local values local. The API validates DATABASE_URL, WEB_BASE_URL, API_PORT, DATABASE_SSL, DB_POOL_MAX and NODE_ENV at startup. Never commit populated environment files or credentials.

Apply migrations and start the workspace:

~~~bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0001_identity_tenancy.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0002_project_lifecycle.sql
pnpm dev
~~~

Open the dashboard at http://localhost:5173. In development, Vite proxies /api and /health to the API on port 4000; browser requests remain same-origin and use the HttpOnly session cookie. The API origin must match WEB_BASE_URL.

**Lockfile note:** pnpm-lock.yaml is not yet committed, so dependency installation still uses --no-frozen-lockfile. A reviewed lockfile is still required before switching CI to frozen installs.

The worker currently prints bootstrap status and exits; it does not execute tests or accept jobs.

## Testing

Unit tests and the PostgreSQL-backed API integration suite:

~~~bash
pnpm test
~~~

The integration suite requires a disposable database named orca_test. It refuses destructive setup against any other database name and CI fails rather than silently skipping it.

~~~bash
# Example disposable local database; never point this at development or production data.
docker run --rm --name orca-test-db -e POSTGRES_USER=orca -e POSTGRES_PASSWORD=orca_test_password -e POSTGRES_DB=orca_test -p 5433:5432 -d postgres:16-alpine

# PowerShell
$env:TEST_DATABASE_URL="postgresql://orca:orca_test_password@localhost:5433/orca_test"
$env:REQUIRE_DB_INTEGRATION="true"
pnpm test:integration
~~~

Dashboard browser tests use Playwright and the real API. CI provisions a separate orca_e2e database, applies migrations, starts the API and dashboard and executes the registration → project create/read/update/archive → logout/login journey.

~~~bash
pnpm test:e2e
~~~

For a local browser run, start the API and dashboard against a disposable migrated database before running the command. See [database migration and rollback guidance](docs/DATABASE_MIGRATIONS.md).

## API foundation

Base prefix: /api/v1

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /health | API health response |
| POST | /auth/register | Create account, organization and owner membership |
| POST | /auth/login | Create authenticated session |
| POST | /auth/logout | Revoke current session |
| GET | /auth/me | Current user and active organization memberships |
| GET | /organizations/:organizationId/projects | List active organization projects |
| POST | /organizations/:organizationId/projects | Create project |
| GET | /organizations/:organizationId/projects/:projectId | Read project |
| PATCH | /organizations/:organizationId/projects/:projectId | Update project |
| POST | /organizations/:organizationId/projects/:projectId/archive | Soft-archive project |

Authentication uses scrypt password hashing and opaque HttpOnly session cookies; only a SHA-256 token hash is stored in the database. Project queries enforce active organization membership and role checks server-side. The dashboard uses the same endpoints; UI visibility is not a substitute for API authorization. See [identity/auth](docs/IDENTITY_AUTH.md) and [project RBAC](docs/PROJECTS_RBAC.md).

## Environment profiles

- **MVP:** env/.env.mvp.example — minimal local development.
- **Prototype:** env/.env.prototype.example — local integration experiments.
- **Test:** env/.env.test.example — disposable PostgreSQL integration database.
- **Production:** env/.env.production.example — placeholders and target settings only; not production approval.

Queue, worker enrollment, evidence storage and hosted model settings are reserved for future milestones and are not consumed by the current app. Read [environment configuration](docs/ENVIRONMENT_CONFIGURATION.md).

## Development workflow

Create a short-lived feature branch from main, keep changes focused, include tests/migrations/contracts/docs, never commit secrets, open a PR, wait for CI and CodeQL, and update changelog/status only for work actually implemented and tested. See [contributing](.github/CONTRIBUTING.md) and [GitHub workflow guidance](docs/GITHUB_WORKFLOW.md).

## Security and responsible testing

Only test systems for which you have explicit authorization. Production load, destructive flows, account changes and external side effects require approval of target, scope, limits and execution window. Worker authorization, SSRF protections, kill switch, rate limits, audit trail and full production controls are still being built. For vulnerability reports, follow [SECURITY.md](.github/SECURITY.md).

## Documentation

- [Engineering status](docs/STATUS.md) · [Master roadmap](docs/MASTER_ROADMAP.md) · [Implementation milestones](docs/IMPLEMENTATION_ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md) · [Repository structure](docs/REPOSITORY_STRUCTURE.md) · [Environment configuration](docs/ENVIRONMENT_CONFIGURATION.md)
- [Security model](docs/SECURITY_MODEL.md) · [Release readiness](docs/RELEASE_READINESS.md) · [GitHub workflow](docs/GITHUB_WORKFLOW.md)
- [Test coverage](docs/TEST_COVERAGE_MATRIX.md) · [Database schema](docs/DATABASE_SCHEMA.md) · [Database migrations](docs/DATABASE_MIGRATIONS.md)
- [API contracts](docs/API_CONTRACTS.md) · [Worker protocol](docs/WORKER_PROTOCOL.md) · [Model strategy](docs/MODEL_STRATEGY.md)
- [OpenClaw boundary](integrations/openclaw/README.md) · [Changelog](CHANGELOG.md)

## License

ORCA AI is released under the [MIT License](LICENSE). Third-party dependencies, model weights and external services remain subject to their own licenses and terms.
