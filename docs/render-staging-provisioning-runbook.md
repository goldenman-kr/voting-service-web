# Render Staging Provisioning Runbook (Archived Alternative)

This runbook is archived as an alternative path. Step 27 changed the active staging target to a user-operated self-hosted server. Use `docs/self-hosted-staging-runbook.md` for the current deployment direction.

Do not follow this Render runbook unless the deployment target is explicitly changed back to Render.

This runbook is a human-executed checklist for creating the internal beta staging environment on Render. It does not create Render resources, deploy the app, generate secrets, store secrets, or approve production launch.

## Source Check

Checked on 2026-06-29:

- Render Next.js web service deployment: https://render.com/docs/deploy-nextjs-app
- Render Postgres creation and connection: https://render.com/docs/postgresql-creating-connecting
- Render Postgres backups and recovery: https://render.com/docs/postgresql-backups
- Render environment variables and secrets: https://render.com/docs/configure-environment-variables
- Render one-off jobs: https://render.com/docs/one-off-jobs
- Render health checks: https://render.com/docs/health-checks

Render platform behavior, pricing, plans, backup features, and retention limits can change. Re-check these pages before provisioning staging.

## Operator Dry-run Summary

This section is the final pre-provisioning input sheet for the Render Dashboard. Fill in the "operator value" column during the real provisioning session. Do not enter real secrets into this document.

### Render Web Service Inputs

| Field | Recommended value / policy | Operator value |
| --- | --- | --- |
| Service name | `voting-service-web-staging` |  |
| Project/environment | Staging-only Render project/environment |  |
| Region | Same as Render Postgres |  |
| Repository | GitHub repo for this project |  |
| Branch | Protected staging branch or `main` after CI is green |  |
| Runtime | Node |  |
| Node version | Node 20 or newer |  |
| Build command | `npm ci && npm run db:generate && npm run build` |  |
| Start command | `npm run start` |  |
| Fallback start command | `npm run start -- --hostname 0.0.0.0 --port $PORT` |  |
| Auto deploy | Off for first provisioning; enable later only after migration/runbook is stable |  |
| Health check | Use Render default TCP health check at first; do not invent a `/health` route in Render settings |  |
| Manual smoke path | `/admin/login`, `/voter/invite` |  |
| Instance type / plan | Paid enough for staging reliability if beta data matters; avoid free/ephemeral behavior for important tests |  |
| Logs to inspect | Deploy logs, runtime logs, one-off job logs, any log stream/APM sink |  |
| Rollback trigger | Failed deploy, failed smoke, missing partial index, log leakage, or data integrity concern |  |

Command compatibility check:

- `package.json` has `build = next build`.
- `package.json` has `start = next start`.
- Render sets a runtime port for web services; keep the fallback command ready if the default `next start` command does not bind correctly.
- Do not add `prisma migrate deploy` to the build command.

### Render Postgres Inputs

| Field | Recommended value / policy | Operator value |
| --- | --- | --- |
| Service name | `voting-service-web-staging-db` |  |
| Database name | Staging-specific name; do not reuse production naming |  |
| User | Staging-specific generated DB user |  |
| Region | Same as Web Service |  |
| PostgreSQL version | Latest Render-supported major compatible with local `postgres:16` baseline |  |
| Plan | Paid plan if backup/PITR or beta data reliability matters |  |
| Backup/PITR | Confirm selected plan supports the desired recovery window before beta data |  |
| Logical backups | Confirm availability and retention for selected plan |  |
| Connection string | Store only in Render env as `DATABASE_URL`; prefer internal URL for same-region web service |  |
| External access | Limit to approved operators only if needed |  |
| Production separation | Must be a separate staging DB; no production URL available in the staging setup session |  |
| Cleanup policy | No broad cleanup; no local/CI E2E cleanup against staging |  |

### Staging Environment Input Table

| Env name | Render input location | Purpose | Required when | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Web Service environment variable | Enables production runtime behavior | Runtime | Fixed value: `production` |
| `APP_URL` | Web Service environment variable | Public staging origin | Runtime | Use staging HTTPS URL |
| `DATABASE_URL` | Web Service secret/env variable | Staging PostgreSQL connection | Runtime, one-off jobs | Use staging DB only; prefer internal URL |
| `SESSION_SECRET` | Web Service secret/env variable | Admin/voter session signing/secrecy | Runtime | Staging-only random value |
| `ENCRYPTION_KEY` | Web Service secret/env variable | Current field-encryption placeholder | Runtime | Staging-only random value; future KMS replacement |
| `HMAC_KEY` | Web Service secret/env variable | Token/hash digest key | Runtime | Staging-only random value; never reuse production |
| `BOOTSTRAP_ADMIN_USERNAME` | Temporary Web Service env or one-off job env | First admin bootstrap | Bootstrap only | Remove after bootstrap |
| `BOOTSTRAP_ADMIN_PASSWORD` | Temporary Web Service env or one-off job env | First admin bootstrap password | Bootstrap only | Remove after bootstrap; never document value |
| `BOOTSTRAP_CONFIRM` | Temporary Web Service env or one-off job env | Confirms production-mode bootstrap | Bootstrap only | Fixed value: `CREATE_INITIAL_ADMIN`; remove after bootstrap |
| Username provider env | Do not set | Future delivery adapter | Disabled | Keep absent |
| SMS provider env | Do not set | Future delivery adapter | Disabled | Keep absent |
| Kakao provider env | Do not set | Future delivery adapter | Disabled | Keep absent |
| KMS env | Do not set | Future field encryption adapter | Disabled | Keep absent |
| APM/logging env | Optional only after redaction review | Future observability | Disabled by default | Do not enable until payload redaction is confirmed |

Secret handling:

- Real secret values must not appear in this file, docs, PRs, screenshots, or logs.
- Staging secrets must differ from local, CI, and future production secrets.
- Bootstrap env values must be removed immediately after successful bootstrap.

### One-off Job Command Order

Run these as Render one-off jobs or controlled shell commands using the Web Service environment. Do not run them against production.

1. Deploy migrations:

```bash
npx prisma migrate deploy
```

2. Seed RBAC:

```bash
npm run db:seed
```

3. Verify the current-ballot partial unique index:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ballots'
  AND indexname = 'unique_current_ballot_per_group';
```

4. Bootstrap the first admin:

```bash
NODE_ENV=production npm run admin:bootstrap
```

5. Run bootstrap a second time and confirm it refuses duplicate initial admin creation.
6. Remove `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_CONFIRM`, and other bootstrap-only env values.
7. Redeploy or restart the Web Service if env removal does not automatically apply.

### Staging Smoke Order

1. Confirm HTTPS URL loads.
2. Open `/admin/login`.
3. Log in as the bootstrap admin.
4. Refresh `/admin` and confirm admin session restore.
5. Log out.
6. Log in again.
7. Create an election draft.
8. Add a question and at least two options.
9. Add/import a test voter with non-real data.
10. Request review.
11. Approve, schedule, and open.
12. Prepare/send invitation stubs.
13. Confirm invite token original is not visible in admin UI.
14. Use an operator-only test fixture or DB-safe test method to obtain a test invite token; do not expose it in UI.
15. Open `/voter/invite`.
16. Verify invite through body-based flow.
17. Verify voter identifier.
18. Submit an anonymous ballot.
19. Revote.
20. Confirm `/voter/complete` does not show previous choices.
21. Close, tally, confirm, and publish.
22. Confirm voter/public result display follows privacy rules.
23. Confirm no Ballot/Vote/AnonymousBallotGroup/token hash appears anywhere in UI.

### Log Leakage Dry-run Checklist

Search locations after deploy, one-off jobs, and smoke:

- Render deploy logs.
- Render runtime logs.
- Render one-off job logs.
- Render Postgres logs, if available.
- Browser console.
- Next.js error output.
- Any log stream or APM sink.

Search for these labels/pattern classes, not real secret values:

- `invite_token`, `inviteToken`, invite token-like URL paths
- `admin_session`, `sessionToken`, `voter_session`, `step_up`
- `ballotGroupToken`, `ballotGroupTokenHash`
- `password`, `one_time_code`, `auth_code`
- raw `User-Agent`, raw `ip`, `x-forwarded-for`
- `ballot_id`, `vote_id`, `anonymous_ballot_group_id`
- `eligible_voter_id` near any Ballot/Vote/SubmissionEvent context
- `voting_credential_id` near any Ballot/Vote/SubmissionEvent context

No-go if logs contain token originals, password values, raw private identifiers, anonymous voting linkage identifiers, request bodies with voting choices, or voter-to-ballot linkage.

### Go / No-go Criteria If Render Is Re-selected

Go only if:

- GitHub remote CI is green.
- Branch protection status is confirmed or explicitly accepted as a first-staging risk.
- Staging branch is fixed.
- Render account/project is ready.
- Staging-only secret generation method is ready.
- Render Postgres plan, backup, and PITR capability are understood.
- Migration SQL is reviewed.
- Bootstrap env removal procedure is understood.
- Log leakage review plan is understood.
- Operator has reviewed this runbook end to end.

No-go if:

- CI is red.
- Production secrets would be reused.
- Production DB connection risk exists.
- Migration SQL is unreviewed.
- Backup/PITR policy is unknown.
- One-off migration procedure is unclear.
- Bootstrap env removal is unclear.
- Log leakage review is not assigned to an operator.
- Any test or smoke failure is unexplained.

## 1. Preconditions

Complete these checks before creating any Render resource:

- GitHub `CI Guardrail Verification` is green on the deployment commit.
- Branch protection is enabled for the protected branch, or the risk is explicitly accepted for the first staging deploy.
- The staging deployment branch is selected. Recommended: `main` after CI is green, or a protected beta branch if the team wants a release-candidate lane.
- Render account and project/workspace are prepared.
- Render account access is limited to trusted operators.
- No production secret is used for staging.
- No production database URL is available to the staging operator shell.
- External username/SMS/Kakao/external identity providers remain disabled.
- Legal-effect voting remains disabled.
- `docs/staging-deployment-plan.md` and this runbook have both been reviewed.

Stop if a production secret, production database, or guardrail relaxation appears necessary.

## 2. Create Render Postgres

Create a dedicated staging database:

- Render service type: Postgres.
- Suggested name: `voting-service-web-staging-db`.
- Database/user names: staging-specific values only.
- Region: same region as the Render Web Service to reduce latency and enable internal networking.
- PostgreSQL version: choose the latest supported major version compatible with the local `postgres:16` baseline unless a specific compatibility reason exists.
- Instance type: choose a paid plan if beta data matters or backup/recovery is required; do not rely on free/ephemeral behavior for important beta data.
- Storage: pick a conservative initial size and note that storage decreases may not be supported.
- Backup/PITR: confirm whether the chosen plan includes point-in-time recovery, logical exports, and backup retention.
- Connection string: use the internal database URL for the Render Web Service when possible.
- External access: keep external access limited to approved operators and only when necessary.
- Production separation: confirm this DB is not named, linked, or networked as production.

Record for the deployment note:

- Render database name.
- Region.
- PostgreSQL major version.
- Plan.
- Backup/PITR capability.
- Whether internal URL is available.

Do not paste `DATABASE_URL` into docs, tickets, screenshots, or chat.

## 3. Create Render Web Service

Create a Render Web Service for the Next.js app:

- Service type: Web Service.
- Suggested name: `voting-service-web-staging`.
- Repository: connect the GitHub repository.
- Branch: selected staging branch.
- Runtime: Node.
- Node version: Node 20 or newer.
- Build command:

```bash
npm ci && npm run db:generate && npm run build
```

- Start command:

```bash
npm run start
```

The current `package.json` start script is `next start`. Render provides `$PORT`, and Next's start command can use the platform port. If Render fails to bind the service, use this explicit start command instead:

```bash
npm run start -- --hostname 0.0.0.0 --port $PORT
```

Auto deploy policy:

- Recommended for first staging setup: off until migration/seed/bootstrap are manually verified.
- After staging stabilizes: enable auto deploy only if CI remains required and migration is still an explicit operator-controlled step.

Health/smoke route:

- Use `/admin/login` as the first human smoke route.
- Use `/voter/invite` as the public voter smoke route.
- If Render health checks require a lightweight endpoint later, add one as a separate implementation step; do not invent one in this runbook.

## 4. Enter Staging Environment Values

Use Render environment variables/secrets. Do not commit `.env`.

Required runtime values:

| Name | Value policy |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_URL` | Staging HTTPS URL, for example the Render URL or staging custom domain |
| `DATABASE_URL` | Render Postgres internal URL for staging only |
| `SESSION_SECRET` | Staging-only random secret, at least 32 bytes/characters of entropy |
| `ENCRYPTION_KEY` | Staging-only random secret, at least 32 bytes/characters of entropy; future KMS replacement |
| `HMAC_KEY` | Staging-only random secret, at least 32 bytes/characters of entropy |

Bootstrap-only values:

| Name | Value policy |
| --- | --- |
| `BOOTSTRAP_ADMIN_USERNAME` | Initial staging admin username |
| `BOOTSTRAP_ADMIN_PASSWORD` | Strong temporary password; remove after bootstrap |
| `BOOTSTRAP_TENANT_NAME` | Staging tenant name |
| `BOOTSTRAP_ORGANIZATION_NAME` | Staging organization name |
| `BOOTSTRAP_ADMIN_ROLE` | `OrganizationOwner` unless explicitly changed |
| `BOOTSTRAP_CONFIRM` | `CREATE_INITIAL_ADMIN` |

Keep these disabled or absent:

- username provider keys
- SMS provider keys
- Kakao provider keys
- external identity provider keys
- SSO provider keys
- legal-effect voting credentials
- KMS provider env until the adapter exists
- APM/logging DSNs until redaction behavior is reviewed

## 5. Staging Secret Generation Guide

Do not put generated secret outputs in this document.

Use a password manager, cloud secret generator, or local command that prints directly to a secure operator terminal. Example command:

```bash
openssl rand -base64 32
```

Generate separate values for:

- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `HMAC_KEY`
- `BOOTSTRAP_ADMIN_PASSWORD`

Rules:

- Staging secrets must differ from local, CI, and future production secrets.
- Bootstrap password must be removed from Render env after successful bootstrap.
- Rotate staging secrets after accidental disclosure.
- Do not paste secrets into PRs, issue comments, screenshots, docs, or Render deploy logs.
- Do not reuse staging secrets for production.

## 6. Migration, Seed, And Bootstrap Sequence

Migration is an explicit operator step. Do not include migration deployment in the web service build command.

Recommended staging approach:

1. Deploy/build the Web Service artifact without running migrations in the build command.
2. Confirm Render Postgres is available.
3. Confirm backup/snapshot capability for the selected plan.
4. Run a Render one-off job or shell command against the Web Service environment:

```bash
npx prisma migrate deploy
```

5. Run RBAC seed:

```bash
npm run db:seed
```

6. Confirm the partial unique index exists:

```sql
SELECT indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'unique_current_ballot_per_group';
```

7. Run one-time admin bootstrap:

```bash
NODE_ENV=production npm run admin:bootstrap
```

8. Run admin bootstrap a second time to confirm it refuses duplicate initial admin creation.
9. Remove `BOOTSTRAP_ADMIN_PASSWORD` and other bootstrap-only values from Render env.
10. Redeploy/restart if env removal requires it.

Migration policy:

- Staging starts with manual one-off migration.
- Production must use migration approval and a separate execution point.
- Do not run `prisma migrate deploy` automatically on every web-service startup.
- Do not use `prisma migrate dev` on staging.

## 7. First Deployment Smoke Checklist

Run after migration, seed, bootstrap, and app deploy:

- Render deploy status is successful.
- HTTPS Render URL loads.
- `/admin/login` loads.
- Admin login succeeds with staging bootstrap admin.
- Admin logout clears the session and returns to login.
- Admin session restores after page refresh.
- `/admin` dashboard loads.
- Create an election draft with non-real test data.
- Add a question and at least two options.
- Confirm AuthenticationPolicy default is `invite_link_with_identifier`.
- Import a test voter with non-real data.
- Request review.
- Approve and open the election.
- Prepare/send invitation stubs.
- Verify no invite token original appears in admin UI.
- Use an operator-only test fixture or DB-safe test method to obtain the test invite token; do not expose it in the UI.
- `/voter/invite` loads.
- Invite token exchange succeeds through body-based flow, not URL path.
- Voter identifier verification succeeds.
- Voter election info loads.
- Anonymous ballot submit succeeds.
- Revote succeeds without displaying previous choices after completion.
- Close, tally, confirm, and publish.
- Voter/public results show only allowed result information.
- Small anonymous result privacy warnings/masking behave as expected.
- No Ballot/Vote/AnonymousBallotGroup/token hash appears in UI.

Record:

- commit SHA
- migration version
- Render service URL
- smoke operator
- smoke timestamp
- known issues

## 8. Basic API Smoke Checklist

Use browser or an operator tool without logging tokens:

- `GET /admin/login` returns 200.
- `GET /voter/invite` returns 200.
- Authenticated `GET /api/v1/admin/auth/me` returns current admin metadata without session token.
- Unauthenticated protected admin route redirects or returns an auth error.
- Voter invite verification uses `POST /api/v1/voter/invitations/verify` with token in body.
- No API URL path contains invite tokens.

Do not run commands that print full cookies, session values, or invite tokens into shell history/logs.

## 9. Log Leakage Review

Inspect these locations:

- Render deploy logs.
- Render runtime logs.
- Render one-off job logs.
- Render Postgres logs, if available for the selected plan.
- Browser console.
- Next.js error output.
- Any configured log stream or APM sink.

Forbidden values:

- invite token original
- admin session token
- voter session token
- step-up token
- ballot group token
- `ballotGroupTokenHash`
- password
- one-time authentication code
- raw IP/User-Agent
- Ballot ID
- Vote ID
- AnonymousBallotGroup ID
- VotingCredential ID
- EligibleVoter ID
- voter-to-ballot linkage

Acceptance:

- Logs can show route names, status, safe event types, and aggregate operational status.
- Logs must not include request/response bodies containing tokens, passwords, voter identifiers, choices, or anonymous voting linkage identifiers.
- One-off job logs must not print env values.

If leakage is found:

1. Stop beta use.
2. Rotate affected staging secrets/tokens.
3. Delete or restrict log access if possible.
4. File a blocker issue.
5. Do not proceed to production planning until fixed and retested.

## 10. Rollback

App rollback:

- Use Render's previous deploy rollback/redeploy controls.
- Confirm the previous app version is compatible with the current database schema before rollback.

Database rollback:

- Prisma Migrate does not provide automatic rollback.
- Use backup/snapshot restore or an approved forward-fix migration.
- Do not run destructive SQL without explicit approval.
- Preserve audit/security logs before and after rollback.

Before any staging migration that could affect beta users:

- Confirm backup/snapshot exists.
- Record migration version.
- Confirm restore procedure and access.

## 11. Cleanup

Staging cleanup policy:

- Use dedicated staging test tenants and obvious test naming.
- Prefer manual archive/delete procedures until a staging-specific cleanup tool exists.
- Do not run the local/CI `npm run test:e2e:clean` script against staging.
- Do not broaden cleanup safeguards for convenience.
- Never run cleanup against production.

Cleanup record should include:

- tenant/organization/election names
- operator
- reason
- timestamp
- confirmation that no production DB was targeted

## 12. Stop Conditions

Stop provisioning or beta use if any of these occurs:

- Render setup requires app code changes.
- Render setup requires Prisma schema changes.
- Build/start command conflicts with `package.json`.
- A production secret or production database is needed.
- A token must be exposed in UI for testing convenience.
- Migration fails.
- Seed fails.
- Admin bootstrap fails.
- Partial unique index is missing.
- Smoke test fails.
- Logs contain forbidden values.
- Cleanup cannot be safely constrained.

## 13. Final Go / No-Go Checklist

Go for controlled internal beta only if:

- CI is green.
- Branch protection is configured or accepted as a first-staging risk.
- Render Postgres and Web Service are separated from production.
- Staging secrets are unique.
- Migration deploy succeeded.
- RBAC seed succeeded.
- Initial admin bootstrap succeeded and bootstrap env values were removed.
- `/admin/login`, `/admin`, `/voter/invite`, and MVP smoke passed.
- Log leakage review passed.
- Legal-effect voting is disabled.
- External providers are disabled.
- Known production blockers are communicated to internal beta participants.

No-go if any guardrail depends on manual trust rather than code/policy enforcement.
