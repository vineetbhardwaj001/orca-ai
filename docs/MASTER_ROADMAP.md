# ORCA AI — Master Product & Engineering Roadmap

**ORCA = Omni-purpose Reliability, Coverage & Assurance**  
Product: **Universal Autonomous QA Lab**  
V1: Web QA • Hybrid cloud control plane + local/cloud execution workers

## 1. Product vision
ORCA tests unrelated websites and web applications as real users would, using deterministic assertions, measurable performance, autonomous exploration and evidence-backed review. Two modes are supported: deterministic workflows and assertions; autonomous AI exploration and scenario suggestions. Users can choose deterministic, autonomous, or both for every run.

## 2. V1 scope
Supported: websites, web apps, REST APIs, OpenAPI/Postman, WebSocket/Socket.IO, authorized GitHub repositories, local targets via enrolled local worker, cloud/staging targets via isolated workers.
- Identity: signup, login, logout, session expiry/refresh, password reset when safely testable, protected routes, roles and permissions.
- Profile: view/edit, validation, persistence, avatar upload when supported, authorization.
- UI: buttons, links, menus, navigation, forms, search, filters, CRUD, uploads/downloads, pagination, responsive and keyboard accessibility.
- API: schema, status, auth, validation, negative cases, rate limiting and latency.
- Real-time: connect, event delivery/order, duplicate/lost events, reconnect, streaming, feedback latency and timeouts.
- Performance: staged load profiles through 100 synthetic VUs, bounded by worker capacity and explicit target authorization.
Native Android/iOS apps are V2, not V1. No real customer accounts, payment transactions, unsolicited emails/SMS, or destructive production workflows.

## 3. End-to-end user journey
1. Signup/login and create organization.
2. Create project and describe product purpose.
3. Connect website URL, API specification, GitHub repository, or local worker.
4. Confirm authorization and define target allowlist.
5. Discover routes, pages, controls, forms, roles, APIs, real-time channels and workflows.
6. Store a versioned Product Profile with evidence, confidence and unknowns.
7. Generate a product-specific plan; user reviews, edits and approves.
8. Select deterministic/autonomous/both, test suites and safe environment.
9. Dispatch jobs to capable workers and engines.
10. Stream progress, logs, metrics and cancellation state.
11. Reproduce candidate bugs and run independent reviews.
12. Produce HTML, JSON and PDF reports with evidence and run configuration.

## 4. Test catalogue
### Account lifecycle
Signup success/invalid/duplicate/weak password; login success/wrong password/unknown account; logout invalidates session; protected-route denial; session expiry/refresh; password reset through a test inbox or deterministic test hook; role/tenant isolation; profile read/update/validation/persistence; avatar constraints; account deletion only in disposable tenants with approval.

### UI and interactions
Every visible button: enabled/disabled state, click, navigation or expected side effect. Validate links, menus, keyboard operation, forms, boundary values, loading/success/error/empty/offline states, duplicate submits, responsive layout, browser console/network errors and accessibility.

### API
Auth, authorization, schemas, status codes, validation, negative tests, pagination, persistence, browser/API state consistency, tenant boundaries, rate limits and error shape.

### Real-time and feedback
Measure connection/handshake time; event delivery latency; event ordering, loss, duplicates and reconnect recovery; stream chunk interval/jitter; queue delay and backpressure; request-to-feedback end-to-end time. When instrumentation exists, split network, queue wait, server processing, model inference and UI render. Report p50/p90/p95/p99/max, timeout/error rate and missing events. Never invent internal spans that are not instrumented.

### Performance
k6 profiles: 1, 5, 10, 25, 50, 100 VUs; ramp, steady-state, ramp-down. Report throughput, iteration duration, p50/p90/p95/p99, errors and available resource metrics. 100 VUs means scripted concurrent sessions, not 100 LLMs. Staging is default; production requires approval, ceiling, time window and kill switch.

### Security, accessibility and resilience
Allowlist/redirect/SSRF protections, TLS/cookies/session flags, access control, IDOR/BOLA patterns, CSRF where applicable, secret leakage, dependency/static checks, axe checks, worker disconnect, retries, timeouts and cancellation.

## 5. Hybrid architecture
### Cloud control plane
React + Vite + TypeScript + SCSS dashboard; Node.js + Express + TypeScript modular API; PostgreSQL source of truth; Redis + BullMQ queue; Socket.IO live updates; object storage abstraction for traces/screenshots/videos/reports; OpenClaw adapter for agent orchestration only.

### Execution plane
Local worker connects outbound and can reach only explicitly allowed local/private dev targets. Cloud worker executes public/staging targets in isolated Docker containers. Workers advertise browser/API/realtime/performance/repository capabilities. Jobs are scoped, leased, time-limited, cancellable, auditable and idempotent where possible. Local worker is not a generic network tunnel.

### Engines
Playwright for browser and APIRequestContext; k6 for load; ws and socket.io-client for real-time; axe-core for accessibility; Vitest, Supertest and Playwright for ORCA's own tests.

### OpenClaw role
OpenClaw is an optional agent gateway/control integration for sessions, tools, skills and agent delegation. ORCA owns tenancy, authorization, queue, execution, evidence, metrics and verdicts. OpenClaw is not the test runner, database, security boundary or source of truth.

## 6. Agent roles
Discovery Agent; Journey Planner; Exploratory User Agent; API Analyst; Real-time Analyst; Bug Investigator; Security Reviewer; QA Lead; Final Auditor. These are logical roles, not one LLM per virtual user. Bounded agent pool; deterministic scripts generate load.

## 7. Model strategy — free/open-weight first
Build a provider-neutral ModelGateway. Candidate experiments:
- Qwen3.5-4B, Apache-2.0 on its Hugging Face card: local low-resource baseline for discovery summaries, extraction, scenario drafts and classification. Validate tool-call reliability before browser control. https://huggingface.co/Qwen/Qwen3.5-4B
- Qwen3 family with Qwen-Agent: candidate for tool/function calling; pin exact checkpoint and check its card/license. https://github.com/QwenLM/Qwen3
- OpenAI gpt-oss-20b, Apache-2.0: reasoning/agentic evaluation candidate; model card says published MXFP4 runs within about 16 GB memory and requires Harmony format, so not a default on an 8 GB laptop. https://huggingface.co/openai/gpt-oss-20b
- Mistral Devstral Small 2 24B, Apache-2.0: coding/repository exploration candidate; official card describes 24B and 32 GB RAM / RTX 4090 class local deployment. Use hosted free inference only if an active quota exists, or a capable server. https://huggingface.co/mistralai/Devstral-Small-2-24B-Instruct-2512

Free hosted quotas are changeable and never guaranteed. Keep deterministic fallback. Record model ID/revision, license, quantization, latency, token use, failure rate and eval score. Benchmark 30–50 fixed tasks: discovery accuracy, scenario precision, schema validity, tool-call success, hallucination rate, reproducibility, latency and cost. Validate structured output, retry/repair once, then fallback. Model output cannot authorize out-of-scope actions, assign PASS, or mark a bug VERIFIED.

## 8. Technology choices
| Layer | Technology | Reason |
|---|---|---|
| Dashboard | React, Vite, TypeScript, SCSS | familiar and fast |
| API | Node.js, Express, TypeScript | modular monolith |
| Contracts | Zod + OpenAPI | runtime validation and API docs |
| Database | PostgreSQL + Prisma or Drizzle | relational tenancy and run history |
| Queue | Redis + BullMQ | scheduling, leases, retries |
| Live events | Socket.IO | progress updates |
| Browser/API | Playwright | real journeys and API checks |
| Load | k6 | deterministic 100 VUs |
| Realtime | ws + socket.io-client | event/latency checks |
| Accessibility | axe-core | automated assertions |
| Platform tests | Vitest + Supertest + Playwright | unit/API/E2E |
| Runtime | Docker Compose first | reproducible local/cloud workers |
| Agent orchestration | OpenClaw adapter | optional agent control |
| Model runtime | Ollama first; vLLM later | local and scalable inference |
| Observability | Pino + OpenTelemetry; Prometheus/Grafana later | logs, traces, metrics |

## 9. Delivery phases and exit criteria
0. Product contract: threat model, statuses, acceptance tests, two unrelated sample apps.
1. Foundation: monorepo, dashboard/API/worker shells, contracts, Docker Compose, CI. Clean install/build/typecheck/lint/test.
2. Identity and tenancy: signup/login/logout/refresh/profile, orgs, roles, project CRUD, audit. Cross-tenant tests fail closed.
3. Connectors: website, GitHub, OpenAPI/Postman, local worker enrollment, target allowlists.
4. Discovery: Playwright crawler, routes/pages/controls/forms, API inventory, versioned Product Profile. Two unrelated products produce different profiles.
5. Planning/personas: test plan, synthetic personas, deterministic/autonomous/both modes, approval.
6. Functional engine: auth/profile, CRUD, forms, navigation, buttons, upload, responsive, sessions; traces/screenshots.
7. API + real-time: contract tests, WebSocket/Socket.IO events, end-to-end feedback latency and seeded defect reproduction.
8. Performance: k6 ramp profiles starting at 100 VUs and scaling beyond 100 when worker capacity and target authorization allow, percentiles, thresholds, stop control.
9. Security/accessibility/resilience: tenant isolation, redaction, axe, recovery/retry/cancel.
10. OpenClaw + model evaluation: provider abstraction, restricted agent tools, deterministic fallback.
11. Review/evidence/reports: bug reproduction, independent review, HTML/PDF/JSON.
12. Hybrid deployment: cloud control plane, local/cloud workers, revocation, backups and release checklist.

## 10. V1 acceptance criteria
- Test at least two unrelated web products.
- Discover and test signup/login/logout/profile where available.
- Actually click visible buttons, submit forms and verify resulting state.
- Measure API and real-time response times with explicit measurement boundaries.
- Measure feedback end-to-end; split server spans only when instrumented.
- Run 100 deterministic VUs on authorized staging with resource ceilings.
- Support deterministic, autonomous and combined modes.
- Capture screenshots, traces, sanitized logs, timing metrics and reports.
- Enforce tenant/project isolation and worker revocation.
- Recover from worker disconnect, timeout and cancellation.
- Distinguish PASS, FAIL, BLOCKED, SKIPPED, NOT_RUN and NEEDS_REVIEW.
- Never claim a test ran unless its assertion executed.

## 11. Engineering rules
Small PRs only; never push directly to main. Keep migrations/contracts/tests with each feature. No fake UI controls or mock production results. Secrets never enter Git. Add regression tests for bugs. Each milestone ends with executed build/test output and a report distinguishing implemented, tested, partial and blocked.
