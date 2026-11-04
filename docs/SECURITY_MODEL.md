# ORCA Security Model

## Trust boundaries

Treat submitted URLs, websites, repositories, source files, API responses, documents, browser content, model output, and worker jobs as untrusted.

## Target authorization

- Require the project owner to confirm authority to test each target.
- Use explicit per-project domain, scheme, port, and path allowlists.
- Revalidate DNS resolution and redirects to mitigate SSRF and DNS rebinding.
- Block loopback, link-local, private, metadata-service, and other reserved destinations for cloud workers unless a separately approved isolated test environment explicitly requires them.
- Local workers may access local targets only through an explicit local allowlist.
- Never let a worker act as a general-purpose proxy into a user's network.

## Execution isolation

- Execute browser and repository workloads in isolated containers.
- Set CPU, memory, process, time, filesystem, and network limits.
- Use read-only source mounts unless a job explicitly requires a disposable writable workspace.
- Do not execute arbitrary repository install scripts on the control plane.
- Restrict worker capabilities and job scope.

## Credentials and sensitive data

- Never commit secrets.
- Store credentials using an encrypted secret-storage abstraction.
- Use short-lived worker credentials and revocation.
- Redact Authorization headers, cookies, passwords, tokens, and sensitive form values.
- Avoid collecting real customer data; use synthetic test identities.
- Restrict evidence/report access by organization and project.

## Destructive and high-impact actions

- Require explicit approval for destructive workflows.
- Default load tests to staging.
- Require explicit target authorization and configured rate/concurrency ceilings.
- Implement cancellation and a global stop control.
- Record every agent-initiated action in audit logs.

## Application security

- Enforce authorization in backend services, not just the UI.
- Protect sessions and refresh-token rotation.
- Validate all inputs and upload types/sizes.
- Apply rate limits and CSRF protections where appropriate.
- Apply tenant isolation in queries and, where suitable, PostgreSQL RLS.
- Test cross-tenant access explicitly.

## AI agent safety

- Give agents only the tools required for their role.
- Never allow an agent to independently bypass approval gates.
- Treat model responses as untrusted suggestions.
- Deterministic engines decide test outcomes.
