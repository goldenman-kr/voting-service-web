# Server Agent Handoff

This document hands the online voting service MVP from the local macOS development environment to the future office Linux server agent. It is the starting point for Step 29 and later self-hosted staging work.

Do not paste secrets, database URLs, passwords, invite tokens, session tokens, or bootstrap credentials into chat, logs, issues, pull requests, screenshots, or documents.

## A. Project Summary

- Product: online voting service MVP for closed voter-registry based organization elections.
- Admin login, DB-backed admin sessions, and password-confirmation based step-up boundaries are implemented.
- Admin UI and voter UI are connected to real MVP API/service boundaries.
- PostgreSQL Prisma migration and RBAC seed are implemented.
- Playwright MVP browser smoke test is implemented and has passed locally.
- GitHub Actions CI guardrail workflow is configured.
- Self-hosted staging is running for internal beta smoke at `https://voting.kryp.xyz`.

## B. Completed Step Summary

- Step 0-1: Requirements, service principles, guardrails, permissions, role mappings, authentication policy, election states, field exposure, and anonymous voting invariants.
- Step 1.6: Next.js App Router, TypeScript, Prisma, Tailwind, Vitest, and env validation foundation.
- Step 2: ERD-based Prisma schema.
- Step 3: Domain state machine and policy helpers for elections, authentication policy, ballots, results, audit requirements, and field exposure.
- Step 4: Server response/error helpers, RBAC authorization, admin session shape, audit/security event boundaries, and handler wrappers.
- Step 5-5.5: Voter authentication policy, body-based invite token exchange, voter session model, repository boundaries, and Prisma adapters.
- Step 6-6.5: Admin election setup, voter registry/invitation boundaries, state transitions, and audit boundaries.
- Step 7: Anonymous ballot submission and revote using a client-held random ballot group token.
- Step 8: Result tally, ResultVersion, confirmation, publication, correction, invalidation, and report export metadata boundaries.
- Step 9: MVP admin/voter UI skeletons and static UI guardrail checks.
- Step 10: MVP flow tests, operational exception tests, audit coverage checks, privacy regressions, and UI smoke checks.
- Step 10.5: Local PostgreSQL Docker Compose development environment.
- Step 11: PostgreSQL migration, raw partial unique index for current ballots, RBAC seed, and DB integration test foundation.
- Step 12: Prisma repository integration and route adapter wiring for core MVP boundaries.
- Step 13-14: DB-backed admin login/session, step-up foundation, admin login UI, protected admin routing, and safe admin bootstrap command.
- Step 15: Admin UI connection for election creation, questions/options, authentication policy, voter registry, and review request.
- Step 16: Voter UI connection for invite exchange, identifier verification, election info, ballot submission, revote, completion, and results.
- Step 17: Admin state transition CTA, reason capture, step-up checks, result tally/confirm/publish CTA, correction/invalidation skeletons, and invitation CTA boundaries.
- Step 18: Playwright MVP browser E2E smoke test passed locally.
- Step 19: E2E test-data cleanup policy, release readiness checklist, development workflow notes, and npm audit review.
- Step 20: GitHub Actions CI guardrail workflow added for migrations, seed, tests, typecheck, build, Playwright E2E, and cleanup.
- Step 21: Remote CI first-run guidance, branch protection recommendation, PR template, and issue templates.
- Step 22: Production-like local rehearsal passed with clean rehearsal DB migration deploy, RBAC seed, admin bootstrap, production build/start smoke, and Playwright E2E.
- Step 23-26: Production and staging planning, Render runbooks, operator checklist, and Go/No-go criteria.
- Step 27: Render path stopped; staging direction changed to self-hosted Linux server.
- Step 28: Dockerfile, `docker-compose.staging.yml`, `.env.staging.example`, backup script example, reverse proxy examples, and self-hosted runbook updates completed.
- Step 29-32: Office Linux server pre-flight, staging env creation, Docker Compose app/PostgreSQL bring-up, migration deploy, RBAC seed, initial admin bootstrap, RBAC admin permission repair, HTTPS smoke at `https://voting.kryp.xyz`, app/PostgreSQL log leakage quick check, and local compressed PostgreSQL backup snapshot completed.
- Step 33: Full staging MVP smoke passed through admin election creation, question/options, voter registry import, review/approve/schedule/open, invitation prepare/send stub, invite/identify, ballot submit, revote, close/tally/confirm/publish, published result viewing, DB sanity checks, and app/PostgreSQL log leakage review.
- Step 34: Staging test-data inventory, cleanup policy, RBAC drift review, and restore rehearsal preparation completed. Destructive cleanup was not run.
- Step 35: Full restore rehearsal passed from the compressed staging backup into an isolated temporary PostgreSQL container with no host port exposure. Temporary restore resources were removed afterward.
- Step 36: The two failed Step 33 draft smoke elections were cleaned up from staging, the successful published smoke election was preserved, and `StagingSmokeOperator` was retained as documented DB-only staging drift.
- Step 37: Staging backup hardening options documented. No provider secret, private key, or offsite upload was created.
- Step 38/39: Age-based encrypted backup setup was deferred for the current staging/internal beta phase because operator-only key custody would concentrate recovery risk. Local backup with file mode `600` and the passed isolated restore rehearsal are accepted only for non-production staging/internal beta.

## C. Next Step For Server Agent

Next step: **staging operational hardening**.

The server agent must not inspect or modify Caddy unless the operator explicitly asks. Caddy is user-managed and proxies `voting.kryp.xyz` to `127.0.0.1:3334`.

Check:

- The successful published `Staging Smoke Vote step33-*` election remains in staging as smoke evidence.
- The two failed Step 33 `ready_for_review` draft smoke elections have been removed.
- Step 33 added a DB-only `StagingSmokeOperator` role for smoke coverage. It is not in source guardrails or seed, remains staging-only drift, and must be removed or replaced through a separate RBAC design decision before production.
- Full restore rehearsal passed from the local backup snapshot under `/mnt/data_4tb/voting-service-web/backups/`.
- Backup hardening is planned in `docs/backup-and-restore-plan.md`; encryption, offsite copy, key custody/recovery, and recurring restore drills remain production blockers.
- Do not install `age`, generate keys, create encrypted backups, or upload offsite backups unless the operator explicitly reopens the encryption/offsite policy.

## D. Server Pre-flight Commands

Run these on the office Linux server only. Mask hostnames, IPs, usernames, and paths if needed.

```bash
uname -a
lsb_release -a 2>/dev/null || cat /etc/os-release
whoami
pwd
df -h
free -h
docker --version
docker compose version
docker ps
sudo ss -tulpn | grep -E ':80|:443|:3000|:5432|:5433|:8080|:8088' || true
which caddy || true
which nginx || true
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

Do not include secrets, database URLs, passwords, tokens, cookies, or full environment dumps in the response.

## E. Server Agent Response Format

Use this exact format after pre-flight:

```text
Server OS:
CPU/arch:
Memory:
Disk free:
Current user:
Deploy directory candidate:
Docker:
Docker Compose:
Existing containers summary:
Ports 80/443/3000/5432/5433/8080/8088:
Reverse proxy:
PostgreSQL strategy:
Domain/subdomain:
DNS control:
HTTPS plan:
Secret management:
Backup storage:
Offsite backup:
Restore rehearsal:
Production secret/DB reuse:
```

Never paste the actual `.env.staging`, `DATABASE_URL`, passwords, or tokens.

## F. Server Agent Decision Criteria

Default recommendation until server evidence says otherwise:

- Use single-server Docker Compose staging.
- Run the app and PostgreSQL as containers.
- Reuse an existing host Caddy/Nginx reverse proxy if present and safe.
- Do not expose PostgreSQL on a public host port.
- Bind the app to localhost by default: `${APP_HOST:-127.0.0.1}:${APP_HOST_PORT:-3334}:3000`.
- Proxy user-managed Caddy/Nginx to `127.0.0.1:3334`.
- Create `.env.staging` only on the server.
- Set `.env.staging` permissions to `chmod 600`.
- Remove bootstrap env values after initial admin creation.
- Take and verify database backups before relying on beta data.

The current draft assumes Docker PostgreSQL for first staging, but host PostgreSQL or managed PostgreSQL can be selected after pre-flight if that is safer.

## G. Absolute Prohibitions

The server agent must not:

- Expose secrets, DB URLs, passwords, tokens, cookies, or private keys in chat/logs/docs.
- Reuse production secrets.
- Connect to a production database.
- Expose PostgreSQL on a public port.
- Overwrite existing Caddy/Nginx configs without inspecting the live server first.
- Stop or delete existing containers without explicit operator approval.
- Change Prisma schema.
- Generate new migrations.
- Change app features.
- Relax guardrails.
- Show invite tokens in operational UI.
- Run cleanup scripts against staging or production without a staging-specific safety review.
- Use `.env`, `.env.staging`, or `.env.production` as committed files.

## H. Prepared Server Deployment Files

- `Dockerfile`: multi-stage Next.js production image draft.
- `.dockerignore`: excludes secrets, local build output, docs, tests, and git metadata from image build context.
- `docker-compose.staging.yml`: app + PostgreSQL staging Compose draft; app binds localhost, PostgreSQL has no host port mapping.
- `.env.staging.example`: placeholder-only staging env template. Copy to server-local `.env.staging` and replace values on the server only.
- `docs/self-hosted-staging-runbook.md`: main self-hosted staging runbook.
- `docs/self-hosted-reverse-proxy-examples.md`: Caddy/Nginx examples for future server-specific configuration.
- `scripts/backup-postgres-staging.sh.example`: `pg_dump` staging backup example.
- `docs/release-readiness-checklist.md`: readiness gates and CI/guardrail checklist.
- `docs/implementation-status.md`: current implementation state and remaining blockers.

## I. Candidate Follow-up Steps

- Provision backup encryption/offsite storage and recurring restore drills.
- Decide production RBAC role design for approval/publication duties and remove or replace `StagingSmokeOperator` before production.
- Confirm reverse-proxy access-log redaction without exposing secrets.
- Confirm remote CI after pushing staging runtime changes.

## J. Sensitive Information Rules

- Do not upload real `.env.staging` to GitHub.
- Commit only `.env.staging.example`.
- Do not write secret values in docs.
- Do not paste `DATABASE_URL` in chat.
- Mask token/password/DB URL values before sharing logs.
- If output accidentally contains a secret, stop and rotate that secret before continuing.
