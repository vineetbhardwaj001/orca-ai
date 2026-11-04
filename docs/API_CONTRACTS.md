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
