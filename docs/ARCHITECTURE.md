# ORCA Architecture

## Goals

Build a universal web-product QA platform that supports deterministic testing and autonomous AI exploration without depending on any single AI provider.

## V1 supported targets

1. Public and staging websites.
2. Authenticated web applications with explicitly supplied test credentials.
3. REST APIs described by OpenAPI/Swagger or Postman collections.
4. WebSocket and Socket.IO applications.
5. Authorized GitHub repositories.
6. Local development applications accessed by an enrolled local worker.

Native mobile application testing is deferred to V2.

## Control plane

- React + Vite + TypeScript dashboard with SCSS.
- Node.js + Express + TypeScript API.
- PostgreSQL for durable project, plan, run, result, and audit data.
- Redis + BullMQ for job queues and coordination.
- Socket.IO for authenticated live updates.
- OpenClaw behind an application-owned orchestration adapter.
- Object storage abstraction for screenshots, traces, videos, and reports.

## Execution plane

Local and cloud workers share the same runtime and contracts. Each worker advertises capabilities such as browser, API, performance, discovery, and real-time testing. Workers authenticate outbound, receive scoped jobs, validate target authorization, execute in isolated containers, report progress, upload evidence, and clean up.

Local workers must not expose arbitrary inbound ports or become unrestricted bridges into private networks.

## Engines

- Playwright: real browser workflows and UI assertions.
- API runner: HTTP contract, schema, auth, negative, and timing tests.
- k6: controlled concurrent load and performance testing.
- Real-time engine: event delivery, ordering, reconnect, streaming, and feedback latency.
- AI agents: discovery interpretation, scenario suggestions, exploration, investigation, and review.

AI output is never sufficient by itself to mark a test PASS or a bug VERIFIED. Deterministic assertions and reproducible evidence control those decisions.

## Execution lifecycle

1. Register project and authorized target.
2. Connect a source: website, GitHub, API specification, or local worker.
3. Discover pages, controls, routes, APIs, and workflows.
4. Store a versioned product profile with confidence and evidence.
5. Generate product-specific scenarios.
6. Require approval where policy says so.
7. Schedule jobs on eligible workers.
8. Execute and collect structured results/evidence.
9. Reproduce and review suspected failures.
10. Generate HTML/PDF/JSON reports.

## Reliability

Jobs use IDs, leases, idempotency keys, bounded retries, cancellation, worker heartbeats, and explicit terminal states. Retrying a non-idempotent workflow must require investigation or a new test identity.

## Deployment

Use one modular monolith for the control plane and separately deployable worker processes. Avoid premature microservices and Kubernetes. Use Docker Compose for local development and deploy cloud services independently when needed.
