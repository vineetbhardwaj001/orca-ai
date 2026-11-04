<div align="center">

# ORCA AI
**Omni-purpose Reliability, Coverage & Assurance**
*Universal Autonomous QA Lab*

[![ORCA CI](https://github.com/vineetbhardwaj001/orca-ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vineetbhardwaj001/orca-ai/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.3.0--alpha.1-orange)](CHANGELOG.md)
[![Stage](https://img.shields.io/badge/stage-prototype-blue)](docs/STATUS.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Test software like real users. Verify outcomes like an engineer.**
</div>

ORCA is being built as a universal quality-assurance platform for authorized websites, web applications, APIs, real-time systems and source-code repositories. It combines deterministic test engines with AI-assisted discovery, planning, exploration, bug investigation and evidence review.

> **Stage: Prototype / early MVP foundation.** The current repository contains identity and project-management API foundations, a dashboard shell, shared contracts and a worker bootstrap. PostgreSQL-backed integration tests now exercise auth, role permissions and tenant boundaries in CI. Real browser/API/realtime/load execution, secure worker enrollment and production operations remain under development.

## Project status

| Area | Current state |
|---|---|
| Monorepo foundation | Implemented |
| Dashboard | Shell; not connected to auth/project APIs |
| Identity API | Implemented; PostgreSQL integration coverage in CI |
| Organization/project API | Implemented; tenant/role integration tests in CI |
| PostgreSQL migrations | Initial identity and project lifecycle migrations |
| Shared contracts | Initial job, worker and outcome schemas |
| Model gateway | Provider abstraction; not wired into product workflows |
| Worker | Bootstrap only; execution disabled |
| Browser/API/realtime/performance engines | Planned; not implemented |
| Production operations and hardening | Not ready |

CI passing means the current automated checks pass against the repository state. It does not mean all planned ORCA capabilities are implemented or that the service is production-ready. See [engineering status](docs/STATUS.md).

## What ORCA is designed to test

- **Web journeys:** navigation, links, buttons, forms, validation, CRUD, search, uploads, responsive behavior and accessibility.
- **APIs:** OpenAPI contracts, authentication, authorization, validation, negative cases and latency.
- **Real-time systems:** WebSocket/Socket.IO events, ordering, reconnect behavior, streaming and end-to-end feedback timing.
- **Performance:** controlled k6 scenarios using deterministic virtual users—not one LLM agent per virtual user.
- **Repositories:** authorized source inspection, dependency/configuration review and evidence-backed findings.
- **AI-assisted QA:** discovery, test-plan suggestions, exploratory scenarios, bug triage and independent review.

All testing must be authorized, scope-limited and evidence-backed. Deterministic assertions—not model opinions—must decide pass/fail outcomes.

## Architecture

ORCA follows a **modular-monolith control plane with separately deployable execution workers**.

| Layer | Technology | Responsibility |
|---|---|---|
| Dashboard | React 18, Vite 6, TypeScript, SCSS | Project and test operations UI |
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
│   ├── api/                 # Express API, route handlers, SQL migrations and DB integration tests
│   ├── dashboard/           # React + Vite + SCSS dashboard
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

Copy .env.example to .env and set local values. Never commit populated environment files or credentials.

**Lockfile note:** pnpm-lock.yaml is not yet committed, so installs currently use --no-frozen-lockfile. A reviewed lockfile remains a release-readiness task.

Apply migrations:

~~~bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0001_identity_tenancy.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/0002_project_lifecycle.sql
pnpm dev
~~~

The worker currently prints bootstrap status and exits; it does not execute tests or accept jobs.

## Testing

Unit tests:

~~~bash
pnpm test
~~~

PostgreSQL integration tests require a disposable database named orca_test. The suite refuses destructive setup against any other database name and CI is configured to fail rather than silently skip the suite.

~~~bash
# Start a separate disposable test database. Do not use development or production data.
docker run --rm --name orca-test-db -e POSTGRES_USER=orca -e POSTGRES_PASSWORD=orca_test_password -e POSTGRES_DB=orca_test -p 5433:5432 -d postgres:16-alpine

# PowerShell
$env:TEST_DATABASE_URL="postgresql://orca:orca_test_password@localhost:5433/orca_test"
$env:REQUIRE_DB_INTEGRATION="true"
pnpm test:integration
~~~

CI starts an isolated PostgreSQL 16 service and runs these tests on every pull request. Coverage includes registration, current-user membership, duplicate email, invalid login, logout/session revocation, cross-tenant list/read/update/archive denial, and viewer/member/admin project permissions. This suite is not an independent security audit.

## API foundation

Base prefix: /api/v1

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /health | API health response |
| POST | /auth/register | Create account, organization and owner membership |
| POST | /auth/login | Create authenticated session |
| POST | /auth/logout | Revoke current session |
| GET | /auth/me | Current user and active organizations |
| GET | /organizations/:organizationId/projects | List active organization projects |
| POST | /organizations/:organizationId/projects | Create project |
| GET | /organizations/:organizationId/projects/:projectId | Read project |
| PATCH | /organizations/:organizationId/projects/:projectId | Update project |
| POST | /organizations/:organizationId/projects/:projectId/archive | Soft-archive project |

Authentication uses scrypt password hashing and opaque HttpOnly session cookies; only a SHA-256 token hash is stored in the database. Project queries enforce active organization membership and role checks server-side. See [identity/auth](docs/IDENTITY_AUTH.md) and [project RBAC](docs/PROJECTS_RBAC.md).

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

## GitHub About panel

Suggested description: **Universal QA lab for browser, API, real-time and performance testing with evidence-backed AI assistance.**

Suggested topics: qa-automation, autonomous-testing, playwright, api-testing, performance-testing, k6, websocket-testing, typescript, react, nodejs, ai-agents.

## Documentation

- [Engineering status](docs/STATUS.md) · [Master roadmap](docs/MASTER_ROADMAP.md) · [Implementation milestones](docs/IMPLEMENTATION_ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md) · [Repository structure](docs/REPOSITORY_STRUCTURE.md) · [Environment configuration](docs/ENVIRONMENT_CONFIGURATION.md)
- [Security model](docs/SECURITY_MODEL.md) · [Release readiness](docs/RELEASE_READINESS.md) · [GitHub workflow](docs/GITHUB_WORKFLOW.md)
- [Test coverage](docs/TEST_COVERAGE_MATRIX.md) · [Database schema](docs/DATABASE_SCHEMA.md) · [API contracts](docs/API_CONTRACTS.md) · [Worker protocol](docs/WORKER_PROTOCOL.md)
- [Model strategy](docs/MODEL_STRATEGY.md) · [OpenClaw boundary](integrations/openclaw/README.md) · [Changelog](CHANGELOG.md)

## License

ORCA AI is released under the [MIT License](LICENSE). Third-party dependencies, model weights and external services remain subject to their own licenses and terms.
