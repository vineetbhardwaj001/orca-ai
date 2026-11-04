# ORCA API Contracts

Base path: /api/v1

All endpoints use authenticated organization/project authorization where applicable. Responses use a consistent envelope and validated schemas.

## Authentication
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- POST /auth/refresh
- GET /auth/me
- PATCH /users/me

## Organizations
- POST /organizations
- GET /organizations
- GET /organizations/:organizationId
- POST /organizations/:organizationId/members
- PATCH /organizations/:organizationId/members/:userId

## Projects
- POST /projects
- GET /projects
- GET /projects/:projectId
- PATCH /projects/:projectId
- DELETE /projects/:projectId

## Connectors and targets
- POST /projects/:projectId/connectors
- GET /projects/:projectId/connectors
- POST /projects/:projectId/targets/validate

## Discovery
- POST /projects/:projectId/discoveries
- GET /projects/:projectId/discoveries/latest
- GET /discoveries/:discoveryId
- GET /discoveries/:discoveryId/pages
- GET /discoveries/:discoveryId/features
- POST /discoveries/:discoveryId/approve

## Plans and runs
- POST /projects/:projectId/test-plans/generate
- GET /projects/:projectId/test-plans
- GET /test-plans/:planId
- POST /test-plans/:planId/approve
- POST /test-plans/:planId/runs
- GET /runs/:runId
- POST /runs/:runId/cancel
- GET /runs/:runId/results
- GET /runs/:runId/metrics

## Workers
- POST /workers/enroll
- POST /workers/:workerId/revoke
- GET /workers
- Worker progress and job dispatch use the authenticated persistent worker channel.

## Findings and evidence
- GET /projects/:projectId/bugs
- GET /bugs/:bugId
- POST /bugs/:bugId/reviews
- GET /executions/:executionId/evidence
- POST /evidence/upload-intents
- POST /runs/:runId/reports
- GET /reports/:reportId

## Live events

Authenticated project/run-scoped Socket.IO events:
- run:created, run:started, run:progress, run:completed, run:failed, run:cancelled
- discovery:progress
- worker:connected, worker:disconnected
- agent:started, agent:completed
- test:started, test:passed, test:failed
- bug:discovered, bug:verified
- evidence:uploaded
- report:generated

## Standard error shape

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "requestId": "..."
  }
}

Never return secrets or internal stack traces to clients. Add pagination, request IDs, idempotency where required, and consistent validation to all applicable endpoints.

This is the initial contract. Keep OpenAPI documentation synchronized with the implemented routes; do not expose routes that do not exist.


## Worker control-plane API (v0.5)

All worker-management routes are under `/api/v1`. Owner/admin-only management routes require the existing authenticated ORCA session cookie. Worker-to-control-plane routes require `Authorization: Bearer <worker-credential>`; completion also requires `X-ORCA-Lease-Token`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/organizations/:organizationId/workers/enrollment-tokens` | Owner/admin session | Issue a one-use 15-minute enrollment token and authorize its capability set |
| POST | `/organizations/:organizationId/workers/enrollment-tokens/:tokenId/revoke` | Owner/admin session | Revoke an unclaimed one-time enrollment token |
| GET | `/organizations/:organizationId/workers` | Owner/admin session | List workers without exposing credential hashes |
| POST | `/organizations/:organizationId/workers/:workerId/revoke` | Owner/admin session | Revoke credential, revoke active leases and requeue eligible jobs |
| POST | `/organizations/:organizationId/jobs/echo` | Owner/admin session | Queue an active-project echo job with an organization-scoped idempotency key |
| POST | `/worker-enrollments/claim` | One-use enrollment token | Consume token and receive a 30-day worker credential once |
| POST | `/workers/:workerId/heartbeat` | Worker bearer credential | Update worker status/version/last heartbeat; cannot change capabilities |
| POST | `/workers/:workerId/jobs/claim` | Worker bearer credential | Claim a capability-matched job and receive a 60-second lease |
| POST | `/workers/:workerId/jobs/:jobId/complete` | Worker + active lease tokens | Validate and persist the echo result |

v0.5 executes only `worker.echo`. It does not offer shell execution, arbitrary scripts, browser automation or external target testing. See [worker protocol](WORKER_PROTOCOL.md) for payloads, lifecycle, lease recovery and setup instructions.
