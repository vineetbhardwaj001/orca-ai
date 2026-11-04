# Environment Configuration

## Profiles

Use one profile per environment. Copy the selected example into your deployment secret/configuration system; do not commit populated environment files.

| Profile | Template | Intended use | Production-safe? |
|---|---|---|---|
| Local / MVP | [env/.env.mvp.example](../env/.env.mvp.example) | Current API, PostgreSQL and local echo-worker development | No |
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

`WEB_BASE_URL` is used for credentialed CORS and same-origin mutation checks. Keep it identical to the browser-visible dashboard origin. In local Vite development, `/api` and `/health` are proxied to the API, so the browser uses the dashboard origin.

## Worker runtime variables

The worker reads the following values. They are not required by the API process.

| Variable | Behavior |
|---|---|
| ORCA_API_BASE_URL | API origin; defaults to http://127.0.0.1:4000 for loopback development. Remote worker endpoints must use HTTPS. |
| ORCA_ENROLLMENT_TOKEN | Optional one-use 15-minute token used only for first enrollment. Never commit it. |
| ORCA_WORKER_CREDENTIAL_FILE | Local credential-file path; defaults to ~/.orca/worker-credential.json. |
| WORKER_NAME | Display name submitted during enrollment; defaults to orca-worker. |
| WORKER_POLL_INTERVAL_MS | Poll delay when idle; defaults to 2000 ms. |
| WORKER_HEARTBEAT_INTERVAL_MS | Idle heartbeat cadence; defaults to 15000 ms. |
| WORKER_VERSION | Worker-reported version; defaults to 0.5.0. |

The worker stores its returned credential locally with POSIX mode `0600` and a containing directory mode `0700`. Windows does not enforce these POSIX mode bits; use a worker account with restrictive NTFS profile-directory ACLs. The credential file is a secret. Back it up securely or revoke/re-enroll after loss. Do not copy it into the dashboard or commit it.

## Tooling and deployment variables

| Variable | Consumer / note |
|---|---|
| WEB_PORT | Local tooling / Compose convention; Vite currently uses 5173 |
| API_BASE_URL | Dashboard/API tooling convention; dashboard uses same-origin `/api/v1` requests |
| APP_ENV | Deployment/profile label; not used by the API runtime schema |
| POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB | Docker Compose local database initialization |
| TEST_DATABASE_URL | API integration tests; must resolve to `orca_test` |
| REDIS_URL | Reserved for a future BullMQ-backed queue; v0.5 uses PostgreSQL row locks and persisted job rows |

## Reserved for upcoming milestones

The following values may appear in prototype/production templates to document future integration needs. Their presence is **not** proof that the feature exists:

- WORKER_CONTROL_URL, WORKER_CAPABILITIES: no separate worker-control service exists yet; the current worker uses the same API origin and server-authorized capabilities.
- EVIDENCE_STORAGE_*: evidence storage is not wired into execution.
- MODEL_*, GEMINI_API_KEY, HUGGINGFACE_API_TOKEN: provider abstraction exists, but worker orchestration is not connected.
- SESSION_SECRET: current sessions use random opaque tokens and database-stored SHA-256 token hashes; this variable is not currently read.
- EVIDENCE_SIGNING_SECRET: evidence signing is not implemented yet.

Do not make application startup depend on unused placeholders. Add typed schema validation when a variable becomes a real runtime dependency.

## Test database safety

The integration test suite runs migrations and truncates its test tables. It refuses to start unless `TEST_DATABASE_URL` resolves to a PostgreSQL database whose name is exactly `orca_test`. Use a disposable local container or the isolated PostgreSQL service in GitHub Actions. Never point it at a development, staging or production database.

The Playwright CI journey uses a separate disposable `orca_e2e` database. CI creates it, applies the dashboard-required identity and project migrations and points only the browser-test API process at it. The API PostgreSQL integration suite applies all three current migrations to `orca_test`.

## Security rules

1. Generate independent high-entropy values for every secret and environment.
2. Store secrets in a managed secret store; inject them at runtime.
3. Never share production credentials between MVP, staging and production.
4. Use TLS for external traffic and managed database connections.
5. Keep CORS origins exact; do not use wildcard origins with credentialed sessions.
6. Restrict database roles and network access; keep pool size below the managed database connection budget.
7. Rotate credentials, audit access and test restore procedures.
8. Worker bearer credentials and lease tokens must never enter request logs, source control, screenshots or frontend storage.
9. Revoke compromised workers immediately; expired credentials are rejected on every worker endpoint.
10. Request logs must remain metadata-only; never add bodies, cookies, authorization headers or passwords.

## Adding a variable

When adding a runtime variable: document purpose and owner; validate it with a typed schema; provide a safe development default only when appropriate; update every relevant example profile; redact it from logs; add tests for missing/invalid configuration; and note whether it is optional or required. Do not silently accept insecure production defaults.
