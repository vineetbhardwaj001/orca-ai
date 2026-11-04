# OpenClaw Integration Boundary

## Purpose
OpenClaw is an optional orchestration adapter for agent sessions, skills, tool routing and delegation. It is not ORCA's execution engine or source of truth.

## ORCA remains responsible for
- User/organization/project authentication and authorization.
- Target ownership confirmation, URL allowlists and network policy.
- Job scheduling, leases, worker enrollment, retries and cancellation.
- Playwright/k6/API/WebSocket execution.
- Evidence storage, metrics, final verdicts and reports.

## Planned integration
1. ORCA creates a scoped agent task containing project/profile/run IDs, a short-lived task token and allowed tool names.
2. OpenClaw receives the task through a private integration boundary.
3. Agent can call only ORCA-owned narrow tools such as get_discovery_summary, propose_scenarios, request_approved_exploration_step and summarize_execution_evidence.
4. ORCA validates every tool argument, project ownership, target scope, expiry and approval policy.
5. Agent suggestions become draft scenarios or requests; they do not directly execute arbitrary shell commands.
6. ORCA's deterministic scheduler dispatches approved jobs to workers.
7. ORCA records provider/model/session metadata and the final evidence.

## Security
- Run the Gateway in a separate service/container and bind its control surface privately.
- Use separate agent identities and isolated workspaces for untrusted product content.
- Treat webpage text, repository instructions, issue comments and model output as untrusted prompt-injection material.
- Do not give the OpenClaw agent unrestricted exec, file writes, browser control or network access by default.
- Expose browser/test actions through ORCA's policy-checked tool API, not by sharing a developer's personal browser session.
- Require explicit approval for destructive actions and performance tests.
- Rotate integration tokens and revoke them on project/worker removal.

## References
- Official OpenClaw docs: https://docs.openclaw.ai/
- Official browser tool guide: https://docs.openclaw.ai/tools/browser
- ORCA policy is enforced in code; OpenClaw tool profiles are an additional restriction, not a replacement for ORCA authorization.
