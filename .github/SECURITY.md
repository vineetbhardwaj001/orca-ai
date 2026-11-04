# Security Policy

## Supported versions

ORCA is currently a pre-release prototype. Security fixes are applied to the active development branch; no stable production support window is offered yet.

## Reporting a vulnerability

Please do not publish exploit details in a public issue. Contact the repository maintainer through the private contact method available on the GitHub profile and include:

- A concise description and impact assessment.
- Affected commit, branch or component.
- Reproduction steps and a minimal proof of concept.
- Any suggested mitigation.

Do not access, modify or exfiltrate other users' data while investigating. Do not run destructive tests or load tests against systems without explicit authorization.

## Response expectations

The maintainer will acknowledge reports when reasonably possible, validate the issue in a controlled environment, coordinate a fix and publish a security advisory when appropriate. Response times are not guaranteed while the project remains a prototype.

## Scope

Relevant areas include authentication/session handling, tenant isolation, target authorization, SSRF, worker isolation, secret handling, evidence access controls and unsafe agent/tool execution.
