# Contributing to ORCA AI

Thank you for helping improve ORCA.

## Before opening an issue or pull request

- Search existing issues and discussions.
- Describe expected behavior, actual behavior and reproducible evidence.
- For security issues, do not create a public issue; follow SECURITY.md.

## Local development

1. Use Node.js 22+ and pnpm 9.15.4.
2. Copy .env.example to an ignored local .env.
3. Start local dependencies with docker compose up -d postgres redis.
4. Install dependencies and apply SQL migrations using the README instructions.
5. Run pnpm typecheck, pnpm test and pnpm build.

A committed pnpm lockfile is still pending. Until it exists, local installs and CI use --no-frozen-lockfile.

## Branches and commits

- Branch from the latest main.
- Use feat/, fix/, docs/ or chore/ prefixes.
- Prefer conventional commit messages, such as feat(api): add project filtering.
- Never push directly to main or force-push a shared branch.

## Pull request expectations

- Explain the user problem and implementation approach.
- Link related issues and include screenshots/log excerpts when useful.
- Add tests for behavior changes and regressions.
- Include migrations and backward-compatibility notes for database changes.
- Update API contracts and environment examples when relevant.
- Identify security, tenant-isolation, privacy and performance impact.
- Distinguish implemented, tested, partial and planned work.
- Do not include secrets, customer data or generated evidence.

## Engineering principles

- Authorization is enforced server-side.
- Tenant-scoped queries bind the authenticated user and active membership.
- Model output is untrusted input; deterministic assertions decide test outcomes.
- Target execution must remain allowlisted, bounded and cancellable.
- Avoid premature microservices and speculative performance optimization.
