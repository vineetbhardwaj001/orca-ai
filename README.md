# ORCA AI

**ORCA** stands for **Omni-purpose Reliability, Coverage & Assurance**.

ORCA AI is the working name for a universal, hybrid, AI-orchestrated Quality Assurance Lab. It helps teams understand and test authorized websites, web applications, APIs, and GitHub repositories through real browser execution, API assertions, performance testing, autonomous exploration, and evidence-backed reports.

> ORCA is the project identity. The product descriptor is **Universal Autonomous QA Lab**.

## V1 scope

- Websites and web applications
- REST APIs and WebSocket-enabled products
- Authorized GitHub repositories
- Local development targets through an outbound-connected local worker
- Cloud/staging targets through isolated cloud workers
- Deterministic test plans and autonomous AI exploration
- Authentication, profile, UI, functional, API, real-time, performance, security, and accessibility testing
- Synthetic virtual users and controlled load testing
- Evidence-backed findings and independent review

Native Android and iOS application testing are outside V1 scope.

## Architecture

ORCA uses a hybrid control-plane/execution-plane model:

- **Cloud control plane:** React dashboard, Node.js API, PostgreSQL, Redis/BullMQ, Socket.IO, orchestration, reports, and evidence metadata.
- **Execution plane:** Docker-isolated local and cloud workers running Playwright, API checks, and k6.
- **AI layer:** OpenClaw adapter and provider-independent model interfaces. AI plans and investigates; deterministic engines execute assertions and determine test outcomes.

## Safety principles

Only test targets for which the project owner has authorization. Local workers use authenticated outbound connections and explicit target allowlists. Destructive actions and high-impact load tests require approval. Secrets and sensitive data must be redacted from logs and evidence.

## Repository status

This repository is being initialized. Implementation must proceed in verified milestones. A module is not complete until its tests have actually executed and results are documented.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Implementation roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Worker protocol](docs/WORKER_PROTOCOL.md)
- [API contracts](docs/API_CONTRACTS.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
