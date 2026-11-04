# ORCA Worker Protocol

## Connection model

Workers establish authenticated outbound persistent connections to the control plane. No arbitrary inbound connection to a worker is required.

## Identity and enrollment

Each worker has:
- Stable worker ID.
- Organization binding.
- Capability declaration.
- Short-lived credential.
- Revocation state.
- Last heartbeat.
- Runtime version.

Enrollment must be authorized by an organization administrator. Credentials must be stored securely and rotatable.

## Capabilities

Examples:
- browser.playwright
- api.http
- performance.k6
- realtime.websocket
- discovery.website
- repository.inspect

A job is dispatched only to a worker with the required capabilities and approved target scope.

## Lifecycle

UNREGISTERED -> ENROLLING -> CONNECTED -> IDLE -> VALIDATING -> RUNNING -> UPLOADING -> COMPLETED -> IDLE

Failure states include FAILED, CANCELLED, LOST, and NEEDS_REVIEW.

## Job envelope

Every job includes:
- jobId
- runId
- organizationId
- projectId
- targetId
- issuedAt
- expiresAt
- idempotencyKey
- requiredCapabilities
- executionLimits
- approvedTargetScope
- test configuration reference

Workers must validate job scope and expiry before execution.

## Reliability

- Heartbeats detect disconnected workers.
- Leases prevent simultaneous ownership.
- Progress updates are sequence-numbered.
- Results are idempotently accepted.
- Retries are bounded and policy-controlled.
- Non-idempotent jobs must not be blindly retried.
- Cancellation is cooperative, followed by forced container termination after a configured grace period.
- Temporary browser profiles and files are removed after completion.

## Evidence

Evidence uploads use short-lived upload authorization and checksums. Workers must redact secrets before upload. The control plane verifies size, type, ownership, checksum, and execution association.

## Safety

A worker may only access targets explicitly authorized for its organization/project. It is not a generic network tunnel, remote shell, or unrestricted repository runner.
