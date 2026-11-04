# ORCA Repository Structure

~~~text
orca-ai/
├── apps/
│   ├── dashboard/                 # React + Vite + TS + SCSS
│   ├── api/                       # Express control-plane API
│   └── worker/                    # Local/cloud execution worker
├── packages/
│   ├── contracts/                 # Shared Zod DTOs and schemas
│   ├── config/                    # Typed env validation
│   ├── database/                  # ORM schema and migrations
│   ├── logger/                    # Structured logging and redaction
│   ├── auth/                      # Session/JWT and RBAC
│   ├── target-policy/             # Allowlist and SSRF protections
│   ├── queue/                     # BullMQ contracts
│   ├── realtime/                  # Socket.IO event contracts
│   ├── evidence/                  # Artifact storage abstraction
│   ├── model-gateway/             # Provider-neutral LLM interface
│   └── test-sdk/                  # Scenario/assertion primitives
├── engines/
│   ├── browser/                   # Playwright discovery and functional tests
│   ├── api/                       # HTTP/OpenAPI test engine
│   ├── realtime/                  # WebSocket/Socket.IO latency engine
│   ├── performance/               # k6 scenarios and runner
│   ├── accessibility/             # axe-core
│   └── security/                  # safe security checks
├── agents/
│   ├── discovery/ journey-planner/ exploratory-user/
│   ├── api-analyst/ realtime-analyst/ bug-investigator/
│   └── security-reviewer/ qa-lead/ final-auditor/
├── integrations/
│   ├── openclaw/                  # agent adapter, skills, tool policies
│   ├── github/
│   ├── huggingface/
│   └── ollama/
├── infra/
│   ├── docker/ compose/ monitoring/ deployment/
├── examples/
│   ├── sample-saas/
│   └── realtime-feedback-demo/
├── tests/
│   ├── contract/ integration/ e2e/ security/ fixtures/
├── docs/
│   ├── MASTER_ROADMAP.md
│   ├── MODEL_STRATEGY.md
│   ├── REPOSITORY_STRUCTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_CONTRACTS.md
│   ├── WORKER_PROTOCOL.md
│   └── SECURITY_MODEL.md
├── .github/workflows/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── README.md
~~~

## Dependency direction
Apps may depend on packages and engine interfaces. Engines must not depend on dashboard/API implementation details. Agents call narrow ORCA tools and never access the database directly. Integrations implement provider interfaces. Workers execute scoped jobs and return typed results. Contracts are shared across API, worker, agent and dashboard.

## Build rule
This is the target structure, not a request to create empty folders for every future module. Add modules when their milestone begins.
