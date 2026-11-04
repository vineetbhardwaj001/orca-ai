# ORCA Test Coverage Matrix

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
