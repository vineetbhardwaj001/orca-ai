# ORCA Test Coverage Matrix

## ORCA platform self-tests currently implemented

| Area | Automated coverage in repository | Status |
|---|---|---|
| Password hashing | scrypt hash/verify unit tests | Implemented |
| Project RBAC policy | Role helper unit tests | Implemented |
| API health | Health payload unit test | Implemented |
| Target URL/path policy | Origin normalization, scheme/port/credential checks, local/IP rejection and strict path-prefix checks | v0.6 unit tests |
| SSRF address policy | IPv4/IPv6 classification, mixed DNS answer rejection and DNS answer-count bounds | v0.6 unit tests |
| DNS ownership / rebinding | Exact TXT proof, split TXT record handling and changed address-set rejection | v0.6 unit tests |
| Target onboarding API | Owner/admin authorization, tenant scope, challenge hashing, activation, revocation and private-DNS rejection | v0.6 PostgreSQL integration tests |
| Registration | PostgreSQL integration test: user, organization and owner membership | Added in v0.3 branch; CI pending |
| Duplicate account | Case-insensitive duplicate email returns conflict | Added in v0.3 branch; CI pending |
| Login | Invalid credentials return unauthorized | Added in v0.3 branch; CI pending |
| Session | Unauthenticated request and logout revocation | Added in v0.3 branch; CI pending |
| Tenant boundaries | Cross-tenant list/read/update/archive isolation | Added in v0.3 branch; CI pending |
| Project roles | Viewer/member/admin permission matrix with real PostgreSQL | Added in v0.3 branch; CI pending |
| Dashboard E2E | Signup/login/project lifecycle/logout/login through Playwright | Implemented in CI |
| Worker protocol | Enrollment, heartbeat, echo-job lease/completion, retry, tenant isolation and revoke in PostgreSQL integration tests | Implemented; deterministic echo only |

## Future ORCA product test catalogue

| Feature area | Discovery | Deterministic tests | Autonomous exploration | Evidence / metric |
|---|---|---|---|---|
| Signup | signup page, fields, validation hints | valid/invalid/duplicate signup | alternate user journeys | screenshots, field errors, created test user |
| Login | login form and auth endpoint | success/failure, rate-limit-safe cases | edge-case navigation | response status, session state |
| Logout | logout control and endpoint | session invalidation and protected route | back-button and multi-tab paths | cookie/session state |
| Profile | profile route and fields | view/edit, validation, persistence | unusual but safe edits | before/after values, screenshots |
| Roles/tenant | visible roles and API access patterns | role matrix and cross-tenant denial | attempt unauthorized navigation | 401/403 and audit evidence |
| Buttons/links | visible interactive controls | click, enabled state, expected side effect | discover hidden/alternate flows | locator, action result, trace |
| Forms | fields, required markers | boundary/invalid/valid submission | alternative input sequences | validation and network logs |
| API | OpenAPI/observed calls | schema, auth, negative and timing | suggest missing contract cases | sanitized request/response |
| Real-time | socket endpoints and event names | delivery/order/reconnect | event sequence exploration | timestamps, loss/duplicate count |
| Feedback loop | visible feedback workflow | request-to-render timing | vary safe input patterns | end-to-end latency and spans |
| Performance | endpoints and journey profiles | k6 VU ramps and thresholds | no AI-generated load | p50/p95/p99, throughput, errors |
| Accessibility | DOM/accessibility tree | axe and keyboard checks | propose navigation variants | violations and WCAG references |
| Security | auth boundary and inputs | safe allowlisted checks | candidate finding suggestions | reproducible request and sanitized trace |
| Resilience | retries and offline states | timeout/retry/cancel/disconnect | fault hypotheses, approved only | state transitions and logs |

## Outcome semantics

- PASS: all required deterministic assertions executed and passed.
- FAIL: at least one required assertion failed with evidence.
- BLOCKED: execution could not proceed because a dependency, permission, login or environment was unavailable.
- SKIPPED: intentionally excluded by an approved plan or policy.
- NOT_RUN: no execution attempt occurred.
- NEEDS_REVIEW: evidence is incomplete or ambiguous.

AI-generated suspicion alone is not FAIL. A candidate bug becomes VERIFIED only after deterministic reproduction and reviewer checks.
