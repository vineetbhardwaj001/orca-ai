# Environment Configuration

## Profiles

Use one profile per environment. Copy the selected example into your deployment secret/configuration system; do not commit populated environment files.

| Profile | Template | Intended use | Production-safe? |
|---|---|---|---|
| Local / MVP | [env/.env.mvp.example](../env/.env.mvp.example) | Current API + PostgreSQL development | No |
| Prototype | [env/.env.prototype.example](../env/.env.prototype.example) | Local integration experiments | No |
| Production | [env/.env.production.example](../env/.env.production.example) | Deployment target configuration only | No; release gates are not met |

## Variables consumed by the current code

| Variable | Current consumer | Requirement / behavior |
|---|---|---|
| NODE_ENV | API session cookie | Set to production behind HTTPS so the session cookie receives the Secure flag |
| API_PORT | API server | Optional; defaults to 4000 |
| WEB_BASE_URL | API CORS and mutation-origin checks | Optional; defaults to http://localhost:5173; use the exact deployed dashboard origin |
| DATABASE_URL | PostgreSQL pool | Required when database-backed routes are used |
| DATABASE_SSL | PostgreSQL pool | Set true to enable TLS with certificate verification |
| DB_POOL_MAX | PostgreSQL pool | Optional; defaults to 10 |
| WORKER_NAME | Worker bootstrap | Optional; defaults to orca-local-worker |

WEB_PORT, API_BASE_URL, APP_ENV and POSTGRES_* are useful to local tooling/Compose or deployment configuration, but are not read by the current API runtime. Verify every variable against its consumer before treating it as an application contract.

## Reserved for upcoming milestones

The following values are present in prototype/production templates to document future integration needs. Their presence is **not** proof that the feature exists:

- REDIS_URL: queue and worker coordination; no BullMQ runtime is connected yet.
- WORKER_CONTROL_URL, WORKER_ENROLLMENT_TOKEN, WORKER_CAPABILITIES: authenticated worker enrollment and scoped job dispatch are not implemented.
- EVIDENCE_STORAGE_*: evidence storage abstraction is not wired into execution.
- MODEL_*, GEMINI_API_KEY, HUGGINGFACE_API_TOKEN: provider abstraction exists, but API/worker orchestration is not connected.
- SESSION_SECRET: current sessions use random opaque tokens and database-stored SHA-256 token hashes; this variable is not currently read.
- EVIDENCE_SIGNING_SECRET: evidence signing is not implemented yet.

Do not make application startup depend on unused placeholders. Add typed schema validation when a variable becomes a real runtime dependency.

## Security rules

1. Generate independent high-entropy values for every secret and environment.
2. Store secrets in a managed secret store; inject them at runtime.
3. Never share production credentials between MVP, staging and production.
4. Use TLS for external traffic and managed database connections.
5. Keep CORS origins exact; do not use wildcard origins with credentialed sessions.
6. Restrict database roles and network access; keep pool size below the managed database connection budget.
7. Rotate credentials, audit access and test restore procedures.
8. Production workers must use short-lived scoped credentials and explicit target allowlists.

## Adding a variable

When adding a runtime variable: document purpose and owner; validate it with a typed configuration module; provide a safe development default only when appropriate; update every relevant example profile; redact it from logs; add tests for missing/invalid configuration; and note whether it is optional or required. Do not silently accept insecure production defaults.
