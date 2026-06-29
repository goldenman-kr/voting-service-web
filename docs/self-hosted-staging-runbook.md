# Self-hosted Staging Runbook

This runbook describes how to prepare a self-hosted staging server for the online voting MVP. It does not deploy to a real server, create secrets, change schema, generate migrations, or enable external providers.

## Current Step 28 Status

Step 28 prepares deployment artifacts on the local macOS development machine before the office Linux server is available.

Prepared draft artifacts:

- `Dockerfile`: multi-stage Next.js production image draft.
- `.dockerignore`: excludes secrets, local build output, tests, docs, and git metadata from image context.
- `docker-compose.staging.yml`: draft app + PostgreSQL staging stack.
- `.env.staging.example`: placeholder-only staging env template.
- `docs/self-hosted-reverse-proxy-examples.md`: Caddy and Nginx examples.
- `scripts/backup-postgres-staging.sh.example`: staging `pg_dump` backup example.

Not performed in Step 28:

- no office Linux server access.
- no staging container startup.
- no real `.env.staging` creation.
- no secret generation.
- no migration execution.
- no schema change.
- no app feature change.

Actual server pre-flight remains a later step and must be run on the office Linux server before using these artifacts.

Server-agent entry point for the next handoff: `docs/server-agent-handoff.md`.

## Deployment Model

Recommended first self-hosted staging model:

- Linux server operated by the user.
- Docker Compose for the app stack.
- PostgreSQL in Docker for first staging, unless a managed PostgreSQL database is explicitly chosen.
- Caddy or Nginx reverse proxy with HTTPS/TLS.
- Server-local env/secret file with restricted permissions.
- Explicit operator-run migration, seed, and admin bootstrap commands.
- Operator-owned backup and restore procedures.

Alternative models:

- Node/systemd + host PostgreSQL if the operator prefers classic Linux service management.
- App container + managed PostgreSQL if database backup/PITR should be delegated to a provider.

## Server Requirements

Minimum staging expectations:

- Maintained Linux distribution, preferably Ubuntu 22.04 LTS or 24.04 LTS.
- Non-root deploy user.
- SSH key-based login.
- Firewall enabled.
- Only required ports exposed:
  - `22/tcp` for SSH, preferably restricted by source IP.
  - `80/tcp` and `443/tcp` for HTTP/HTTPS.
  - PostgreSQL port not publicly exposed.
- Docker and Docker Compose installed if using the recommended model.
- Sufficient disk for database volume, logs, and backups.
- Time synchronization enabled.
- Domain or subdomain ready for staging.

## Architecture

```mermaid
flowchart TD
  AdminVoter["Admin / Voter Browser"] --> TLS["HTTPS Staging Domain"]
  TLS --> Proxy["Caddy or Nginx"]
  Proxy --> App["Next.js App Container or Service"]
  App --> DB["PostgreSQL: Docker / Host / Managed"]
  App --> Env["Server Env File"]
  Proxy --> ProxyLogs["Proxy Logs"]
  App --> AppLogs["App Logs"]
  DB --> DbBackups["Encrypted Backups / Restore Rehearsal"]
```

## Pre-flight Checklist

Use this exact format before starting provisioning:

```text
CI status:
staging branch:
branch protection:
deployment target: self-hosted
server ready:
server OS:
Docker ready:
Docker Compose ready:
domain ready:
HTTPS/reverse proxy ready:
PostgreSQL strategy:
backup plan understood:
staging-only secrets ready:
production secret/DB reuse:
runbook opened:
```

Go only if:

- CI is green.
- staging branch is fixed.
- server is ready.
- production secrets and production DB are not used.
- backup and restore approach is understood.
- operator has this runbook open.

## Directory And File Layout

Recommended server layout:

```text
/srv/voting-service-web/
  repo/
  env/
    staging.env
  backups/
  logs/
```

Recommended permissions:

```bash
chmod 700 /srv/voting-service-web/env
chmod 600 /srv/voting-service-web/env/staging.env
```

Do not store `staging.env` in git.

## Environment Values

Required:

- `NODE_ENV=production`
- `APP_URL`
- `DATABASE_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `HMAC_KEY`

Bootstrap-only:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN`
- `BOOTSTRAP_TENANT_NAME`
- `BOOTSTRAP_ORGANIZATION_NAME`
- `BOOTSTRAP_ADMIN_ROLE`

Disabled/future:

- email provider env
- SMS provider env
- Kakao provider env
- external identity/SSO env
- KMS env
- APM/logging env until redaction is verified

Secret rules:

- Use staging-only random values.
- Never reuse production secrets.
- Never paste real values into docs, chat, PRs, issue comments, screenshots, or logs.
- Remove bootstrap-only values after bootstrap.
- Keep env file readable only by the deploy user.

## Docker Compose Staging Decision

Current repository `docker-compose.yml` is local-development only and starts PostgreSQL only.

Do not reuse it as a production/staging deployment file without review.

Draft file prepared in Step 28: `docker-compose.staging.yml`.

The draft assumes:

- app runs in Docker.
- PostgreSQL runs in Docker.
- app binds to host localhost only through `127.0.0.1:${APP_HOST_PORT:-3000}:3000`.
- PostgreSQL has no host port mapping.
- reverse proxy is host-level Caddy/Nginx or a later Compose addition.
- staging env is read through Compose `--env-file`, and the app service receives only the minimum runtime env values.

Before using it on the office Linux server, confirm:

- app container build strategy.
- PostgreSQL strategy.
- reverse proxy strategy.
- persistent volume paths.
- backup location.
- env file path.
- restart policy.
- network exposure.

Recommended future Compose services:

- `app`
- `postgres`, only if using Docker Postgres
- `caddy` or `nginx`, unless reverse proxy is host-managed

Initial recommendation: keep reverse proxy host-managed until the real server's Caddy/Nginx state is known.

## Provisioning Command Runbook

Commands below show shape and order. Do not paste real secrets into command history.

1. SSH to server:

```bash
ssh deploy@staging-host
```

2. Clone or update repo:

```bash
cd /srv/voting-service-web/repo
git pull --ff-only
```

3. Create/update server env file outside git:

```bash
editor /srv/voting-service-web/env/staging.env
chmod 600 /srv/voting-service-web/env/staging.env
```

4. If using the draft Docker Compose path, validate the compose file first without real secrets:

```bash
STAGING_ENV_FILE=.env.staging.example docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
```

5. On the server, copy the server-local env file to the repo checkout as `.env.staging` or set `STAGING_ENV_FILE` to the server env file path. Then validate with the real staging env file:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml config
```

6. Install dependencies or build app image:

```bash
npm ci
npm run db:generate
npm run build
```

7. Apply migrations:

```bash
npx prisma migrate deploy
```

8. Seed RBAC data:

```bash
npm run db:seed
```

9. Verify the current ballot partial unique index:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ballots'
  AND indexname = 'unique_current_ballot_per_group';
```

10. Bootstrap first admin:

```bash
NODE_ENV=production npm run admin:bootstrap
```

11. Run bootstrap again and confirm duplicate creation is refused:

```bash
NODE_ENV=production npm run admin:bootstrap
```

12. Remove bootstrap-only env values from server env file.
13. Start or restart app.
14. Configure reverse proxy.
15. Confirm HTTPS.
16. Run smoke test.
17. Review logs for leakage.
18. Take initial backup.

## Reverse Proxy

Caddy option:

- simpler automatic HTTPS.
- good first staging choice if supported by server/network.

Nginx option:

- more manual TLS/certificate handling.
- good if operator already uses Nginx.

Minimum requirements:

- HTTPS enabled.
- HTTP redirects to HTTPS.
- request body limits set conservatively.
- proxy access logs reviewed for token leakage.
- PostgreSQL not exposed through proxy or public ports.

Do not add a fake health endpoint. Use `/admin/login` and `/voter/invite` as manual smoke routes until a real health endpoint is implemented.

## Firewall And SSH

Recommended:

- disable password SSH login.
- restrict SSH to operator IPs if possible.
- expose only `80/tcp` and `443/tcp` publicly.
- keep PostgreSQL bound to internal Docker network or localhost only.
- avoid running app as root.

## Backup

Minimum staging backup flow:

1. Take backup before migration.
2. Store backup outside the app repo.
3. Encrypt backup before offsite copy.
4. Record backup filename, timestamp, database name, and operator.
5. Rehearse restore into a non-production database.

Example shape:

```bash
pg_dump "$DATABASE_URL" --format=custom --file "/srv/voting-service-web/backups/staging-YYYYMMDD.dump"
```

Draft helper prepared in Step 28:

```bash
scripts/backup-postgres-staging.sh.example
```

Copy and review it on the server before use. It intentionally refuses production-looking database URLs and does not store database credentials in the file.

For Docker Postgres, also consider volume snapshot/backup. A dump is still needed for portable restore testing.

## Restore Rehearsal

Restore into a separate non-production database:

```bash
createdb voting_service_web_restore_test
pg_restore --dbname voting_service_web_restore_test "/path/to/staging-YYYYMMDD.dump"
```

Then verify:

- migrations table exists.
- key tables exist.
- `unique_current_ballot_per_group` exists.
- no production data was used.

## Smoke Test

Admin:

- HTTPS loads.
- `/admin/login` loads.
- admin login works.
- session restore works after refresh.
- logout works.
- create election draft.
- add question/options.
- add/import test voter.
- request review.
- approve/schedule/open.
- prepare/send invitation stubs.

Voter:

- `/voter/invite` loads.
- invite token is not in URL path.
- identifier verification works.
- election info loads.
- ballot submit works.
- revote works.
- completion page does not display previous anonymous choices.

Result:

- close election.
- tally.
- confirm.
- publish.
- voter/public result is visible according to policy.

## Log Redaction Review

Review:

- app stdout/stderr.
- Docker logs.
- reverse proxy access logs.
- PostgreSQL logs.
- systemd journal if used.
- browser console.

Forbidden values:

- invite token original
- admin session token
- voter session token
- step-up token
- ballot group token
- `ballotGroupTokenHash`
- password
- one-time code
- raw IP/User-Agent
- Ballot ID
- Vote ID
- AnonymousBallotGroup ID
- voter-to-ballot linkage

No-go if any forbidden value appears.

## Rollback

Application rollback:

- redeploy previous git commit or previous app image.
- restart app.
- confirm compatibility with current database schema.

Database rollback:

- restore from backup or apply approved forward-fix migration.
- Prisma Migrate does not provide automatic rollback.
- never run destructive SQL without explicit approval.

## Cleanup

- Use obvious staging test tenant names.
- Archive/delete staging test data manually until a guarded staging cleanup tool exists.
- Do not run local/CI E2E cleanup against staging.
- Do not run any cleanup command against production.

## Production Blockers

Self-hosted staging does not make the app production-ready. Remaining blockers include:

- administrator MFA/WebAuthn.
- KMS-backed field encryption or approved equivalent.
- backup automation and restore rehearsal.
- reverse proxy/access-log redaction verification.
- retention/deletion policy.
- npm audit moderate finding resolution or formal acceptance.
- privacy policy/terms before real user data.
