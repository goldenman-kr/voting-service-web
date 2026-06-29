# Release Readiness Checklist

This checklist describes the current MVP readiness gates. It is intended for local development, internal dry-runs, and beta preparation. It is not a production approval by itself.

## Required Environment Values

- `DATABASE_URL`: PostgreSQL URL only. SQLite is not supported.
- `APP_URL`: Public app origin for the current environment.
- `SESSION_SECRET`: Production must use a high-entropy secret from managed secret storage.
- `ENCRYPTION_KEY`: Placeholder until KMS-backed field encryption is implemented.
- `HMAC_KEY`: HMAC key for hashes and token digests. Production must use managed secret storage.
- `BOOTSTRAP_ADMIN_EMAIL`: One-time bootstrap input only.
- `BOOTSTRAP_ADMIN_PASSWORD`: One-time bootstrap input only. Never hardcode operational passwords.
- `BOOTSTRAP_TENANT_NAME`: Tenant name for bootstrap.
- `BOOTSTRAP_ORGANIZATION_NAME`: Organization name for bootstrap.
- `BOOTSTRAP_ADMIN_ROLE`: Initial admin role.
- `BOOTSTRAP_CONFIRM`: Required for production bootstrap confirmation.

## Local Development Workflow

1. Start PostgreSQL:

```bash
npm run db:up
```

2. Apply migrations:

```bash
npm run db:migrate:dev
```

3. Seed RBAC data:

```bash
npm run db:seed
```

4. Bootstrap an initial admin with one-time environment values:

```bash
BOOTSTRAP_ADMIN_EMAIL="admin@example.com" \
BOOTSTRAP_ADMIN_PASSWORD="replace-with-a-local-test-password" \
npm run admin:bootstrap
```

5. Optional convenience command for local DB startup, migration, and seed:

```bash
npm run dev:ready
```

6. Clean E2E fixture data before or after smoke tests:

```bash
npm run test:e2e:clean
```

7. Run E2E smoke:

```bash
npm run test:e2e
```

## Production-like Rehearsal

Before production deployment, run the local production-like rehearsal in `docs/production-like-rehearsal-runbook.md`. The rehearsal uses a separate local PostgreSQL database named `voting_service_web_rehearsal`, dummy secrets, production build/start, migration deploy, seed, initial admin bootstrap, and smoke checks.

The rehearsal must not use production secrets, production databases, external delivery providers, or cloud infrastructure.

## Production Deployment Planning

Use `docs/production-deployment-plan.md` before choosing a production platform or creating cloud resources. The current recommendation is a two-stage path:

- Internal beta staging on a user-operated self-hosted Linux server, with non-production or explicitly approved low-risk data and known limitations. See `docs/staging-deployment-plan.md` and `docs/self-hosted-staging-runbook.md`.
- Production on managed PostgreSQL, managed secrets, explicit migration approval, backup/PITR, restore rehearsal, logging redaction, administrator MFA/WebAuthn, and KMS-backed field encryption.

Do not create production resources until the production blockers in that plan are either closed or formally accepted.

Staging is not production. It must use separate secrets, a separate database, external providers disabled by default, and explicit migration/seed/bootstrap steps. The current local/CI E2E cleanup script must not be pointed at staging; staging E2E requires a future staging-specific guarded cleanup policy.

## Internal Beta Staging Plan

The approved internal beta staging target is a self-hosted Linux server.

Step 28 prepared self-hosted staging artifacts locally:

- `Dockerfile`: multi-stage Next.js production image draft.
- `docker-compose.staging.yml`: app + PostgreSQL staging Compose draft.
- `.env.staging.example`: placeholder-only staging env template.
- `docs/self-hosted-reverse-proxy-examples.md`: Caddy and Nginx examples.
- `scripts/backup-postgres-staging.sh.example`: `pg_dump` backup example.

The self-hosted staging server has now been provisioned for internal beta smoke at `https://voting.kryp.xyz`.

Confirmed staging shape:

- user-managed Caddy terminates HTTPS and proxies to `127.0.0.1:3334`.
- the app container binds only to `127.0.0.1:3334`.
- PostgreSQL runs inside Docker Compose without a host port mapping.
- migration deploy, RBAC seed, initial admin bootstrap, duplicate bootstrap block, bootstrap env removal, admin login/session/logout/relogin smoke, voter invite page smoke, and app/PostgreSQL log leakage quick check passed.
- the staging bootstrap admin has `OrganizationOwner` plus `ElectionManager` using existing seeded role mappings.
- a compressed local PostgreSQL backup snapshot was created under `/mnt/data_4tb/voting-service-web/backups/` and passed gzip and `pg_restore --list` checks.
- full restore rehearsal is still pending.

Before provisioning staging:

- confirm branch protection and remote CI first run
- confirm server OS, firewall, SSH, Docker/Docker Compose, domain, reverse proxy, and HTTPS approach
- choose PostgreSQL strategy: `docker-postgres`, `host-postgres`, or `managed-postgres`
- document backup and restore approach before migration
- prepare staging-only `DATABASE_URL`, `APP_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, and `HMAC_KEY`
- keep email/SMS/Kakao/external identity providers disabled
- review migration SQL and run `npx prisma migrate deploy` as an explicit operator step
- run `npm run db:seed`
- bootstrap the first staging admin once, then remove bootstrap password env values
- smoke `/admin/login`, `/admin`, and `/voter/invite`
- inspect app, Docker, reverse proxy, PostgreSQL, systemd journal, and browser logs for token, password, PII, and anonymous-voting identifier leakage

Full procedure: `docs/staging-deployment-plan.md`.

Self-hosted provisioning runbook: `docs/self-hosted-staging-runbook.md`.

Render provisioning checklist: `docs/render-staging-provisioning-runbook.md` is archived as an alternative path only.

Confirmed command values for the current Next.js app:

- Build command: `npm ci && npm run db:generate && npm run build`
- Start command: `npm run start`

Staging migration is a manual operator step. Do not put `npx prisma migrate deploy` in the normal app startup path.

For the current self-hosted staging server, keep `.env.staging` and the local credential handoff file untracked and server-local. Do not copy either file into issues, pull requests, docs, chat, or image layers.

Self-hosted staging provisioning can start only after the pre-flight fields in `docs/self-hosted-staging-runbook.md` have been reviewed:

- CI status, staging branch, branch protection, server readiness, server OS, Docker/Docker Compose readiness, domain, reverse proxy, and HTTPS readiness
- PostgreSQL strategy, backup/restore approach, and production DB separation
- staging env file path, permissions, and bootstrap-only env removal procedure
- migration/seed/bootstrap command order
- log leakage search locations across app, Docker, reverse proxy, PostgreSQL, systemd journal, and browser console
- Go / No-go criteria for backup, smoke, and redaction readiness

## Validation Gates

- `npm audit`
- `npm audit --audit-level=high`
- `npm test`
- `npm run typecheck`
- `npm run db:validate`
- `npm run db:generate`
- `npx prisma migrate deploy`
- `npm run db:seed`
- `npm run build`
- `npm run test:e2e`
- `npm run test:e2e:clean`

`npm audit` currently reports moderate findings. CI blocks high and critical findings with `npm audit --audit-level=high`; moderate findings remain a production-readiness blocker until patched or formally accepted. Do not use `npm audit fix --force` without a dependency migration review.

## CI Guardrail Verification

GitHub Actions runs `.github/workflows/ci.yml` on pushes to `main`, pushes to `codex/**`, and pull requests. The workflow performs:

- checkout and Node.js setup
- `npm ci`
- high/critical `npm audit`
- Prisma validate and generate
- `npx prisma migrate deploy` against an isolated PostgreSQL service
- RBAC seed
- unit, integration, and guardrail tests
- TypeScript typecheck
- production build
- Playwright Chromium install
- Playwright MVP browser smoke test
- E2E fixture cleanup, even if an earlier step fails

The CI PostgreSQL service uses the database `voting_service_web_ci`, user `voting_ci`, and CI-only dummy credentials. Production secrets and production database URLs must not be used in CI.

To approximate CI locally:

```bash
npm ci
npm audit --audit-level=high
npm run db:validate
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm test
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:e2e:clean
```

If E2E fails in CI, first check PostgreSQL service health, migration deployment, RBAC seed output, `APP_URL`/`PLAYWRIGHT_BASE_URL` alignment, and the E2E cleanup safety checks.

## Remote CI First-Run Checklist

After pushing a branch or opening a pull request, check GitHub Actions for the workflow named `CI Guardrail Verification`. The required job is `Guardrails, DB, build, and E2E`.

If the first remote run fails, triage in this order:

- PostgreSQL service health: confirm the `postgres:16` service passed `pg_isready`.
- Prisma migration deploy: confirm `npx prisma migrate deploy` ran against `voting_service_web_ci`, not a local or production database.
- Seed: confirm `npm run db:seed` inserted permissions and role mappings.
- Playwright browser install: confirm `npx playwright install --with-deps chromium` completed on Ubuntu.
- Next server startup: confirm `PLAYWRIGHT_BASE_URL`, `APP_URL`, and `E2E_PORT` all point to `http://127.0.0.1:3100`.
- E2E timeout: inspect whether the app failed to start, login failed, or a guardrail assertion failed.
- Cleanup: confirm `npm run test:e2e:clean` did not reject the CI database URL safety checks.

When reporting a failed remote CI run, include the failing step name, the last 50-100 log lines, and whether the failure occurred before or after Playwright started the browser.

## Branch Protection Recommendation

Protect `main` before accepting routine MVP changes. If a long-lived `develop` branch is introduced, apply the same required status check there.

Recommended required settings:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require the `CI Guardrail Verification / Guardrails, DB, build, and E2E` check.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Restrict force pushes.
- Restrict branch deletions.

Optional settings:

- Require linear history if the team wants a simpler history.
- Require signed commits if contributor tooling is ready.
- Require approvals if more than one maintainer is active.
- Dismiss stale approvals when new commits are pushed for higher-risk changes.

Even for a solo-maintained repository, the CI status check should remain required so guardrails cannot be bypassed accidentally.

## PR And Issue Workflow

- Use `.github/pull_request_template.md` for all pull requests.
- Every PR must state whether it changes schema/migrations, security/privacy guardrails, token/PII/log handling, anonymous voting linkage, or Published result behavior.
- UI PRs should include screenshots or a concise visual note.
- Bug reports should use `.github/ISSUE_TEMPLATE/bug_report.md`.
- Feature requests should use `.github/ISSUE_TEMPLATE/feature_request.md`.

CI badges are not added yet because repository visibility and badge exposure policy have not been confirmed. Add a README badge only after confirming it is acceptable for the repository visibility model.

## E2E Cleanup Policy

- E2E fixture tenants must use the `E2E Smoke Tenant e2e-` prefix.
- Cleanup refuses `NODE_ENV=production`.
- Cleanup refuses non-local database hosts.
- Cleanup refuses non-PostgreSQL URLs.
- Cleanup refuses unexpected database names that do not include `voting_service_web`.
- Manual cleanup requires `E2E_CLEANUP_CONFIRM=DELETE_E2E_DATA`.
- Cleanup failure should be treated as a warning in test teardown but investigated before long-running beta use.

## Guardrail Confirmation

- Invite tokens are exchanged through body-based APIs, not URL path parameters.
- Token originals are not stored in DB, logs, UI, or API responses.
- Ballot, Vote, AnonymousBallotGroup, and ballot group token hashes are not exposed in UI.
- Voter completion pages do not show previous anonymous choices.
- Authentication code flow is not part of the MVP default path.
- Published result overwrite is not supported.
- The `unique_current_ballot_per_group` partial unique index exists.
- Production admin routes must not depend on mock admin sessions.
- Staging provisioning must not expose invite tokens, session tokens, ballot group tokens, or Ballot/Vote/AnonymousBallotGroup identifiers in UI, app logs, Docker logs, reverse proxy logs, PostgreSQL logs, systemd journal, or browser console.
- The local/CI E2E cleanup script must not be run against staging.

## Known Non-Production Areas

- External email/SMS/Kakao delivery is not implemented.
- External identity verification and SSO are not implemented.
- Real MFA/WebAuthn is not implemented.
- KMS-backed field encryption is not implemented.
- Backup/restore is not implemented.
- PDF/CSV/Excel report file generation is not implemented.
- Advanced audit export review UI is not implemented.
- DB emergency access console is not implemented.
- Production monitoring and APM/access-log redaction verification are not complete.

## Production Blockers

- Replace development secrets with managed production secrets.
- Implement administrator MFA/WebAuthn.
- Implement KMS-backed encryption and key rotation.
- Implement encrypted backup/restore and restore drills.
- Select and document the production deployment target.
- Configure managed PostgreSQL with backup/PITR and connection pooling.
- Define and automate retention/deletion policies.
- Resolve or formally accept npm audit findings.
- Validate token redaction across app logs, access logs, reverse proxy logs, and APM logs.
- Rehearse migrations against a production-like PostgreSQL environment.
- Keep isolated CI E2E execution against a disposable PostgreSQL service green before merging.
- Configure branch protection in GitHub repository settings so `CI Guardrail Verification` is required before merging.
- Complete staging provisioning, staging migration deploy, admin bootstrap, smoke test, and log redaction review before real participant data is used.
- Complete self-hosted backup/restore rehearsal before any production data collection.
- Prepare terms of service and privacy policy before processing real user/organization data.

## Beta-Test Position

The MVP is suitable for controlled internal beta testing with non-production data after all validation gates pass. It is not ready for public production, legal-effect voting, or high-assurance external identity voting.
