# GitHub Workflow and Branch Protection

## Branch model

- main: protected integration branch; should always represent a reviewed, green state.
- feat/<scope>: feature work, one milestone or feature per branch.
- fix/<scope>: focused bug fixes.
- docs/<scope>: documentation-only work.
- chore/<scope>: tooling, dependency and CI maintenance.

Never work directly on main. Keep pull requests reviewable and avoid force-pushing shared branches.

## Pull request lifecycle

1. Branch from the latest main.
2. Keep commits focused and use descriptive conventional-commit style messages.
3. Include tests and migrations/contracts/docs as required by the change.
4. Open a pull request to main; use draft while work is incomplete.
5. Wait for CI and CodeQL. Fix failures; do not disable checks to force a merge.
6. Review changed files, security impact, database compatibility and rollback plan.
7. Merge only after required review and checks; delete the branch after merge.
8. Verify the merge commit's workflow run and update docs/status.

## Required GitHub repository settings

Configure these in **Settings → Branches → Add branch ruleset** for main:

- Require a pull request before merging.
- Require at least one approval when a second reviewer is available; for a solo repository, use self-review plus passing checks until collaborators are added.
- Require status checks: validate and CodeQL Analyze (javascript-typescript) after their first successful run.
- Require conversation resolution.
- Block force pushes and branch deletion.
- Require linear history only if the selected merge strategy supports it.
- Allow squash merge and keep merge messages descriptive.
- Do not allow bypass except for a documented emergency process.

Repository settings cannot be enforced by workflow YAML alone. Recheck actual branch rules after configuration.

## CI responsibilities

- CI: install dependencies, TypeScript checks, unit tests and production builds on PRs and pushes.
- CodeQL: static security analysis for JavaScript/TypeScript on PRs, main pushes and a weekly schedule.
- Future gates: frozen lockfile, format/lint, DB integration tests, secret scanning, dependency review, E2E browser tests and deployment smoke tests.

## Release process

- Keep package versions aligned across the workspace.
- Use semantic versions: alpha for unstable internal builds, beta for feature-complete candidate builds, and stable versions only after acceptance gates pass.
- Tag only a reviewed commit on main; do not create a release from an unmerged feature branch.
- Maintain CHANGELOG.md with notable changes and migration/configuration notes.
