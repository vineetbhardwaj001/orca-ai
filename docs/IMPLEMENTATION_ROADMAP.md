# ORCA Implementation Roadmap

Every milestone requires executable tests and an evidence-based completion report.

## M1 — Foundation (in progress)

**Implemented on `feat/qa-lab-foundation`:**
- pnpm monorepo, dashboard/API/worker shells and shared execution contracts.
- PostgreSQL identity schema for users, organizations, memberships, projects and sessions.
- Registration, login, logout and current-user endpoints.
- Scrypt password hashing and opaque, hashed server-side session tokens.
- Organization-scoped project list/create/read/update/archive endpoints.
- Backend role policy: Owner/Admin/Member can create and update; Owner/Admin can archive; all active roles can read.
- Project SQL statements scope by organization and active membership; create/update/archive enforce roles in the SQL operation.
- Unit tests for password hashing and project role policy.

**Not yet verified / outstanding:**
- CI run for the latest feature-branch commit.
- Database-backed integration tests for cross-tenant isolation and every project endpoint.
- Full frontend signup/login/project workflow.
- Email verification, password reset, MFA, rate limiting, session rotation and complete CSRF protection.
- Organization membership management and invitations.
- Authenticated local worker enrollment, heartbeat, revocation and echo job.

**M1 exit criteria:** all above backend and frontend capabilities are integrated, database-backed authorization tests pass, and a local worker completes a persisted echo job. M1 is not complete yet.

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
