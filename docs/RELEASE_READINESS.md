# ORCA Release Readiness Gates

## Maturity definitions

### Prototype
A controlled environment where architecture and thin vertical slices can be exercised by developers. Mock services may exist but must be labeled. No customer data or uncontrolled production tests.

### MVP
A complete, repeatable user journey from signup to project setup, target authorization, discovery, test-plan approval, deterministic execution, evidence capture and report review. It must work against at least two unrelated authorized products.

### Production
A supported service with operational ownership, secure deployment, tenant isolation, recoverability, observable execution and tested safety controls. A successful build alone is not a production release.

## Mandatory MVP exit criteria

- PostgreSQL-backed integration tests for register/login/logout/session expiry.
- Cross-tenant list/read/update/archive denial tests and positive role matrix coverage.
- Dashboard signup/login/project list/create/detail connected to real APIs.
- Target onboarding requires explicit authority and per-project allowlists.
- Deterministic browser and API tests execute on real authorized test targets.
- Screenshots, traces, sanitized logs and machine-readable results are stored and linked to a run.
- At least two unrelated products produce distinct discovery profiles.
- Result states distinguish PASS, FAIL, BLOCKED, SKIPPED, NOT_RUN and NEEDS_REVIEW.
- Repeatable install through a committed lockfile; CI checks type, lint/format, tests and build.

## Mandatory production gates

### Security and privacy
- Independent threat model review and penetration test.
- Tested tenant isolation and authorization on every resource boundary.
- Rate limits, account recovery, MFA/strong auth policy, session rotation/revocation and CSRF defenses.
- Secrets managed outside source control; rotation and access audit.
- SSRF/DNS rebinding/redirect defenses and strict worker egress.
- Container isolation with CPU, memory, filesystem, process and network limits.
- Redaction of credentials, cookies, personal data and sensitive form inputs.
- Audit trail for agent decisions, approvals, job actions and administrative changes.

### Reliability and operations
- Database migration strategy, automated backups and restore drills.
- Health/readiness endpoints, structured logs, metrics, traces and alerting.
- Queue retries, idempotency, leases, worker heartbeat/revocation and cancellation.
- Global stop control for jobs and production load tests.
- Incident response, rollback, retention and support runbooks.
- Capacity and cost budgets for browser, model and performance workloads.

### Performance and safety
- k6 profiles validated on staging with agreed ceilings and stop thresholds.
- Explicit production authorization and time window before any production load.
- Worker capacity and resource isolation measured under concurrent tests.
- Evidence integrity and report reproducibility verified.

## Current decision

**Not production ready.** ORCA is in prototype / early MVP-foundation stage. Current identity/project APIs and CI are foundations; MVP and production gates above are not yet satisfied. See [STATUS.md](STATUS.md) for the live implementation list.
