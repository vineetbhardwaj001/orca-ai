# ORCA Security Model

## Trust boundaries

Treat submitted URLs, websites, repositories, source files, API responses, documents, browser content, model output and worker jobs as untrusted.

## Worker enrollment and execution

- Only active organization owners/admins may issue enrollment tokens, list workers, revoke workers or enqueue v0.5 echo jobs.
- Enrollment tokens are random, one-use, valid for 15 minutes and stored as SHA-256 hashes only; owners/admins can revoke unclaimed tokens early.
- Worker credentials are random, expire after 30 days, are stored as SHA-256 hashes only and are checked on every worker request.
- Worker lease tokens are random, scoped to one worker/job claim, expire after 60 seconds and are stored as hashes only.
- Heartbeats update status/version but cannot change organization membership or capabilities.
- Job selection is organization-scoped and requires the job's capability set to be a subset of the worker's server-authorized capabilities.
- PostgreSQL row locks with `SKIP LOCKED` prevent two workers from claiming the same queued row at once.
- Results are accepted only from the worker holding the active, unexpired lease and must match the persisted echo input.
- Revocation invalidates the worker immediately, revokes active leases and requeues jobs only while retry attempts remain.
- The only executable worker job in v0.5 is `echo`. No shell, arbitrary script, browser, external HTTP or repository execution is enabled.

## API abuse controls

- Every worker API route has an explicit express-rate-limit middleware before its database or authorization handler.
- Enrollment issue/claim and privileged mutations use tighter per-IP budgets; worker heartbeat and job polling have higher budgets to support normal worker cadence.
- Rate-limit responses use HTTP 429, a stable JSON error code and standard RateLimit response headers.
- The default limiter store is process-local memory. It protects a single API process, but does not coordinate quotas across multiple replicas or survive restarts. Configure a shared store (for example, Redis) before horizontally scaling the API.
- The limiter keys off Express's client IP. When deploying behind a reverse proxy, configure only the exact trusted proxy hop count for that deployment; do not blindly enable trust for arbitrary forwarded headers.

## Target authorization

- Require the project owner to confirm authority to test each target.
- Use explicit per-project domain, scheme, port and path allowlists.
- Revalidate DNS resolution and redirects to mitigate SSRF and DNS rebinding.
- Block loopback, link-local, private, metadata-service and other reserved destinations for cloud workers unless a separately approved isolated test environment explicitly requires them.
- Local workers may access local targets only through an explicit local allowlist.
- Never let a worker act as a general-purpose proxy into a user's network.

## Execution isolation

- Future browser and repository workloads must execute in isolated containers.
- Set CPU, memory, process, time, filesystem and network limits.
- Use read-only source mounts unless a job explicitly requires a disposable writable workspace.
- Do not execute arbitrary repository install scripts on the control plane.
- Restrict worker capabilities and job scope.

## Credentials and sensitive data

- Never commit secrets.
- Do not expose worker credentials or lease tokens to dashboard/browser storage.
- Store worker credential files with restrictive POSIX permissions; Windows deployments must use restrictive NTFS ACLs.
- Revoke compromised credentials and re-enroll with a fresh one-time token.
- Redact Authorization headers, cookies, passwords, tokens and sensitive form values.
- Avoid collecting real customer data; use synthetic test identities.
- Restrict evidence/report access by organization and project.

## Destructive and high-impact actions

- Require explicit approval for destructive workflows.
- Default load tests to staging.
- Require explicit target authorization and configured rate/concurrency ceilings.
- Implement cancellation and a global stop control before broad execution engines ship.
- Record every agent-initiated action in audit logs.

## Application security

- Enforce authorization in backend services, not just hidden UI controls.
- Protect sessions and worker credentials.
- Validate all inputs and upload types/sizes.
- Apply rate limits and CSRF protections where appropriate.
- Apply tenant isolation in queries and, where suitable, PostgreSQL RLS.
- Test cross-tenant access explicitly.

## AI agent safety

- Give agents only the tools required for their role.
- Never allow an agent to independently bypass approval gates.
- Treat model responses as untrusted suggestions.
- Deterministic engines decide test outcomes.
