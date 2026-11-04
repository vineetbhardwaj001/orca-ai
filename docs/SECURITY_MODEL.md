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

- Every worker and target-management API route has an explicit express-rate-limit middleware before its database or authorization handler.
- Enrollment issue/claim and privileged mutations use tighter per-IP budgets; worker heartbeat and job polling have higher budgets to support normal worker cadence.
- Rate-limit responses use HTTP 429, a stable JSON error code and standard RateLimit response headers.
- The default limiter store is process-local memory. It protects a single API process, but does not coordinate quotas across multiple replicas or survive restarts. Configure a shared store (for example, Redis) before horizontally scaling the API.
- The limiter keys off Express's client IP. When deploying behind a reverse proxy, configure only the exact trusted proxy hop count for that deployment; do not blindly enable trust for arbitrary forwarded headers.

## Target authorization and SSRF boundary (v0.6)

- Only active organization owners/admins can register, verify, list or revoke project targets. Target rows are bound to both `organization_id` and `project_id` by a composite foreign key.
- Registration requires an explicit authorization attestation and an expiry between one hour and ninety days. Expired authorization is not eligible for verification.
- A target is an exact HTTP(S) origin plus explicit path prefixes. v0.6 allows only ports 80/443 matching the scheme; it rejects credentials, URL paths/query/fragments, IP literals, single-label names and local/reserved DNS suffixes.
- Domain control must be proven by a one-time random TXT challenge at `_orca-verify.<hostname>`. Only a SHA-256 digest is stored; the record value is returned once.
- DNS verification resolves all available A/AAAA answers, caps answer count, and rejects the complete set if any address is not globally routable. Private, loopback, link-local, carrier-grade NAT, multicast, unspecified, documentation and reserved ranges are denied using `ipaddr.js` range classification.
- The public DNS answer set is persisted with a 24-hour verification freshness window. The `assertPinnedDnsResolution` guard rejects any changed answer set. A future executor must call it immediately before each connection and pin the validated IP at the socket layer; resolving once and then connecting by hostname would reintroduce DNS-rebinding risk.
- Future HTTP clients must disable automatic redirects or validate every redirect hop against the approved scheme/host/port/path scope and repeat DNS validation before connecting. v0.6 does not follow redirects or send any request to a target.
- v0.6 does not enable local/private target exceptions, target browser/API jobs, arbitrary outbound requests or proxy behavior. No registered target is executable yet; API responses explicitly report `executionEnabled: false`.
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
