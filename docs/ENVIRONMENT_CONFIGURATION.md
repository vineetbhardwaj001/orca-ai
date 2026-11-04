# Environment Configuration

## Profiles

Use one profile per environment. Copy the selected example into your deployment secret/configuration system; do not commit populated environment files.

| Profile | Template | Intended use | Production-safe? |
|---|---|---|---|
| Local / MVP | [env/.env.mvp.example](../env/.env.mvp.example) | Current API + PostgreSQL development | No |
| Prototype | [env/.env.prototype.example](../env/.env.prototype.example) | Local integration experiments | No |
| Test | [env/.env.test.example](../env/.env.test.example) | Disposable PostgreSQL integration database only | No |
| Production | [env/.env.production.example](../env/.env.production.example) | Deployment target configuration only | No; release gates are not met |

## Variables validated by the API runtime

The API entry point uses a Zod schema and exits with a descriptive configuration error before listening if any supplied value is invalid or if the required database URL is missing.

| Variable | Requirement / behavior |
|---|---|
| NODE_ENV | development, test or production; defaults to development |
| API_PORT | Integer from 1 to 65535; defaults to 4000 |
| WEB_BASE_URL | Exact dashboard origin; defaults to http://localhost:5173; no path/query/fragment |
| DATABASE_URL | Required PostgreSQL connection URL |
| DATABASE_SSL | true or false; defaults to false; TLS certificate verification remains enabled when true |
| DB_POOL_MAX | Integer from 1 to 100; defaults to 10 |

WEB_BASE_URL is used for credentialed CORS and same-origin mutation checks. Keep it identical to the browser-visible dashboard origin. In local Vite development, /api and /health are proxied to the API, so the browser uses the dashboard origin.

## Tooling and deployment variables

| Variable | Consumer / note |
|---|---|
| WEB_PORT | Local tooling / Compose convention; Vite currently uses 5173 |
| API_BASE_URL | Informational template value; the dashboard uses same-origin /api/v1 requests |
| APP_ENV | Deployment/profile label; not used by the API runtime schema |
| POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB | Docker Compose local database initialization |
| TEST_DATABASE_URL | API integration tests; must resolve to orca_test |
| WORKER_NAME | Worker bootstrap only |

## Reserved for upcoming milestones

The following values are present in prototype/production templates to document future integration needs. Their presence is **not** proof that the feature exists:

- REDIS_URL: queue and worker coordination; no BullMQ runtime is connected yet.
- WORKER_CONTROL_URL, WORKER_ENROLLMENT_TOKEN, WORKER_CAPABILITIES: authenticated worker enrollment and scoped job dispatch are not implemented.
- EVIDENCE_STORAGE_*: evidence storage abstraction is not wired into execution.
- MODEL_*, GEMINI_API_KEY, HUGGINGFACE_API_TOKEN: provider abstraction exists, but API/worker orchestration is not connected.
- SESSION_SECRET: current sessions use random opaque tokens and database-stored SHA-256 token hashes; this variable is not currently read.
- EVIDENCE_SIGNING_SECRET: evidence signing is not implemented yet.

Do not make application startup depend on unused placeholders. Add typed schema validation when a variable becomes a real runtime dependency.

## Test database safety

The integration test suite runs SQL migrations and truncates its test tables. It refuses to start unless TEST_DATABASE_URL resolves to a PostgreSQL database whose name is exactly orca_test. Use a disposable local container or the isolated PostgreSQL service in GitHub Actions. Never point it at a development, staging or production database.

The Playwright CI journey uses a separate disposable orca_e2e database. CI creates it, applies the migrations and points only the browser-test API process at it.

## Security rules

1. Generate independent high-entropy values for every secret and environment.
2. Store secrets in a managed secret store; inject them at runtime.
3. Never share production credentials between MVP, staging and production.
4. Use TLS for external traffic and managed database connections.
5. Keep CORS origins exact; do not use wildcard origins with credentialed sessions.
6. Restrict database roles and network access; keep pool size below the managed database connection budget.
7. Rotate credentials, audit access and test restore procedures.
8. Production workers must use short-lived scoped credentials and explicit target allowlists.
9. Request logs must remain metadata-only; never add bodies, cookies, authorization headers or passwords.

## Adding a variable

When adding a runtime variable: document purpose and owner; validate it with a typed schema; provide a safe development default only when appropriate; update every relevant example profile; redact it from logs; add tests for missing/invalid configuration; and note whether it is optional or required. Do not silently accept insecure production defaults.
