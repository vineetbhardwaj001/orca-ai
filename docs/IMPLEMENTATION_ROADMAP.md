# ORCA Implementation Roadmap

Every milestone requires executable tests and an evidence-based completion report.

## M1 — Foundation
- pnpm monorepo and TypeScript configuration.
- Dashboard, API, and worker application shells.
- PostgreSQL migrations and Redis queue.
- Authentication, organizations, project CRUD, and tenant isolation.
- Local worker enrollment, authenticated outbound connection, heartbeat, and a harmless echo job.

**Exit criteria:** create a project, enroll a local worker, dispatch an echo job, and receive a persisted result.

## M2 — Product connectors
- Website target registration and allowlists.
- GitHub repository metadata/source inspection with authorized access.
- OpenAPI and Postman import.
- Connector validation and secret references.

## M3 — Discovery
- Playwright crawler and route/page inventory.
- DOM and accessibility-tree inspection.
- Forms, buttons, navigation and controls inventory.
- API specification parsing.
- Versioned product profile and evidence/confidence labels.

## M4 — Test planning
- Product-specific scenarios and priorities.
- Preconditions, data, steps, assertions, engine and approvals.
- Human review/edit/approve workflow.

## M5 — Functional browser engine
- Signup, login, logout, session, profile and protected-route workflows.
- Forms, navigation, buttons, CRUD, search and responsive checks.
- Screenshots, trace, console and network evidence.

## M6 — API engine
- Schema/status/auth/negative/validation/response-time tests.
- Sanitized request and response evidence.

## M7 — Real-time engine
- WebSocket/Socket.IO connectivity, event delivery/order, duplicates, reconnects, streaming and feedback latency.

## M8 — Performance
- k6 scenarios, 1/10/25/50/100 VU profiles, percentiles, throughput and error rates.
- Authorization, staging-first policy, quotas and cancellation.

## M9 — Security and accessibility
- Access-control checks, tenant isolation, secret redaction, dependency/static checks and accessibility tests.

## M10 — AI orchestration
- OpenClaw adapter and provider-independent model interfaces.
- Specialist agents with restricted tools.
- Autonomous exploratory testing and test suggestion workflow.
- Deterministic fallback when model providers fail.

## M11 — Evidence, review and reports
- Bug reproduction workflow, reviewer decisions, immutable run history.
- HTML, PDF and JSON reports.

## M12 — Production readiness
- Two unrelated seeded sample products.
- Local and cloud workers.
- Isolation, recovery, cancellation, load, security and end-to-end acceptance.

## Rules

Do not mark a milestone complete because files were generated. Run the relevant tests, capture outputs, document blockers, and distinguish implemented, tested, partially tested, and not implemented work.
