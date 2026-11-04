# ORCA Repository Structure and Scalability Guide

## Current repository layout

This is the structure that exists today. It is intentionally smaller than the full product vision.

~~~text
orca-ai/
├── apps/
│   ├── api/                    # Express API, auth/project routes, SQL migrations
│   ├── dashboard/              # React + Vite + TypeScript + SCSS
│   └── worker/                 # Worker bootstrap; no test execution yet
├── packages/
│   ├── contracts/              # Shared Zod contracts
│   └── model-gateway/           # OpenAI-compatible provider abstraction
├── integrations/
│   └── openclaw/               # Optional agent-orchestration boundary
├── docs/                       # Architecture, security, status and roadmap
├── env/                        # Environment example templates
├── .github/
│   └── workflows/              # CI and CodeQL
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
~~~

## Target modular structure

Add modules only when the corresponding milestone begins and has real code, tests and ownership. Do not add empty folders just to make the tree look complete.

~~~text
apps/
  api/                 # HTTP boundary, auth, tenancy, project/run control
  dashboard/           # Screens, routing, API client, state and styles
  worker/              # Worker runtime, capability adapters, job lifecycle

packages/
  contracts/            # Versioned request/event/job schemas
  config/               # Typed environment parsing and validation
  database/             # Schema, migrations, query/repository helpers
  auth/                 # Session lifecycle and policy primitives
  target-policy/        # Authorization, allowlists, DNS/redirect/SSRF checks
  queue/                # Job envelopes, BullMQ adapters, retry/lease policy
  realtime/             # Socket.IO event schemas and authorization
  evidence/              # Artifact metadata, redaction and storage adapter
  logger/                # Structured logs, request IDs and redaction
  model-gateway/        # Provider abstraction, budgets and deterministic fallback
  worker-sdk/            # Worker registration, capabilities and result contracts

engines/
  browser/              # Playwright discovery and functional execution
  api/                  # HTTP/OpenAPI contract execution
  realtime/             # WebSocket/Socket.IO checks and latency collection
  performance/          # k6 profiles, thresholds and cancellation
  accessibility/        # axe-core checks
  security/             # Non-destructive authorized security checks

agents/
  discovery/
  journey-planner/
  exploratory-user/
  api-analyst/
  realtime-analyst/
  bug-investigator/
  security-reviewer/
  qa-lead/
  final-auditor/

integrations/
  github/
  openclaw/
  model-providers/

infra/
  docker/
  deployment/
  observability/

tests/
  unit/
  integration/
  e2e/
  security/
  fixtures/
~~~

## Dependency direction

- Apps may depend on stable package interfaces; packages must not import app internals.
- Engines depend on contracts and narrow runtime interfaces, never on dashboard components.
- Agents call scoped ORCA tools; agents do not query the database directly or gain unrestricted shell/network access.
- Integrations implement provider interfaces; the core domain must not depend on one model vendor.
- Workers execute typed, authorized jobs and return versioned results plus evidence references.
- Database access belongs behind application services/repositories as the API grows; keep tenant predicates in the trusted server layer.

## Scale without premature microservices

1. **Start as a modular monolith.** Keep identity, organizations and projects in the API process while domains are small.
2. **Scale execution separately.** Workers are independently deployable and can be scaled by capability, CPU/memory budget and queue depth.
3. **Use asynchronous jobs for long work.** Persist job state, leases, idempotency keys, retry budget, cancellation and terminal state.
4. **Keep contracts versioned.** Dashboard, API, worker and agents share schemas; reject incompatible job protocol versions.
5. **Isolate expensive workloads.** Browser and performance jobs run in bounded containers, not inside the API process.
6. **Measure before splitting services.** Extract a service only when ownership, resource profile, deployment cadence or failure isolation gives measurable benefit.

## Code-quality and optimization rules

- Validate inputs at the boundary with Zod, then pass typed domain values.
- Keep controllers thin; move authorization and use cases into testable services.
- Use parameterized SQL, explicit transactions and tenant-scoped queries.
- Add database indexes from measured query patterns; validate plans with realistic data.
- Bound connection pools, request bodies, concurrency, job duration, memory and retries.
- Use timeouts and AbortSignal for outbound HTTP/model requests.
- Avoid unbounded in-memory queues, global mutable state and synchronous heavy work in request handlers.
- Emit structured logs with request/run/job IDs; redact cookies, tokens and credentials.
- Add unit tests for pure policy, integration tests for DB behavior and E2E tests for complete journeys.
- Prefer measured profiling over speculative micro-optimizations.

## Current optimization debt

- No committed pnpm lockfile; dependency installs are not fully reproducible.
- No centralized typed config or structured logger package.
- API route handlers currently contain direct SQL; extract repositories/services as the domain grows.
- No DB integration suite or cross-tenant security test suite.
- No worker queue/lease runtime or workload isolation implementation.
- Lint script is present at the root, but package-level lint scripts/configuration are not yet consistently defined.

This document defines an incremental design direction; it does not claim future modules already exist.
