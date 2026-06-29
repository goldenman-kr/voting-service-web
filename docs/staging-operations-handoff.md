# Staging Operations Handoff

This handoff is for operating the current self-hosted staging service during internal beta. It does not make the service production-ready, and it does not contain secrets, passwords, database URLs, invite tokens, session tokens, cookies, or private keys.

## Current Operating State

- Staging URL: `https://voting.kryp.xyz`
- App host binding: `127.0.0.1:3334`
- Reverse proxy: user-managed Caddy, outside `docker-compose.staging.yml`
- Caddy handling: do not inspect, overwrite, stop, or restart Caddy from routine voting-service operations unless the operator explicitly requests it
- App/PostgreSQL stack: Docker Compose using `docker-compose.staging.yml`
- PostgreSQL exposure: Docker internal network only; no host port mapping
- Env file: `.env.staging`, server-local, git ignored, mode `600`
- Admin credential handoff: server-local only, git ignored, never copied into chat/docs/issues/PRs
- Bootstrap env values: removed after successful bootstrap
- Backup directory: `/mnt/data_4tb/voting-service-web/backups/`
- Latest known backup posture: local gzip PostgreSQL custom-format dump, mode `600`
- Latest known restore rehearsal: passed in Step 35 using an isolated temporary PostgreSQL container with no host port exposure
- Encrypted backup: deferred for the current staging/internal beta phase
- Offsite backup: pending and retained as a production blocker

## Routine Health Checks

Run from the repository checkout on the staging server:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
curl -I https://voting.kryp.xyz/admin/login
curl -I https://voting.kryp.xyz/voter/invite
```

Expected:

- app and postgres are running.
- app is exposed only as `127.0.0.1:3334->3000`.
- PostgreSQL has no host port mapping.
- admin and voter smoke routes return HTTP 200 or another expected healthy HTTP flow.

## Start And Restart

Start or reconcile the staging stack:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d
```

Restart only the app:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml restart app
```

Do not stop or delete PostgreSQL containers or volumes during routine operations. Do not run `docker system prune` or `docker volume prune` against this server for voting-service maintenance.

## Logs

Review app logs:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=100 app
```

Review PostgreSQL logs:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=100 postgres
```

Before sharing logs outside the server, mask:

- database URLs and database passwords
- admin passwords
- invite tokens
- admin or voter session tokens
- cookies
- ballot group tokens or hashes
- raw auth codes
- values that connect a voter to Ballot, Vote, or AnonymousBallotGroup records

Caddy logs are not part of the default voting-service operating surface. Do not inspect Caddy logs/config/autosave unless the operator explicitly opens that scope and masking rules are clear.

## Backup

Current accepted staging/internal beta posture:

- local gzip PostgreSQL backup exists under `/mnt/data_4tb/voting-service-web/backups/`.
- backup file mode is `600`.
- isolated local restore rehearsal passed once.
- encrypted backup, offsite backup, key custody/recovery policy, and recurring restore drills remain production blockers.

Backup script template:

```text
scripts/backup-postgres-staging.sh.example
```

The real script, if copied locally, must remain untracked and must not hardcode secrets. The current template uses Docker Compose backup mode so PostgreSQL remains unexposed.

## Restore Rehearsal Summary

The proven Step 35 restore pattern:

1. Create an isolated temporary PostgreSQL container, network, and volume.
2. Do not attach the running app to the restore database.
3. Do not expose a host PostgreSQL port.
4. Restore the gzip-compressed custom-format dump with `pg_restore`.
5. Check only schema/count/index sanity.
6. Remove the temporary restore container, network, and volume.

Do not print raw row data, tokens, hashes, private data, database URLs, or any voter-to-ballot linkage during restore checks.

## Internal Beta Rules

Allowed:

- operator/developer internal testing
- non-production data
- limited test voters
- feature verification elections
- staging smoke runs

Not allowed:

- legal-effect voting
- production/public operation
- real customer or organization official decision votes
- large sensitive personal-data imports
- long-term official data retention
- important data accumulation while encrypted/offsite backup remains unimplemented

## Admin Account And RBAC Notes

- Initial admin credentials are in a server-local handoff location only.
- The credential handoff file is not tracked by git.
- Credential contents must not be copied into chat, docs, issues, pull requests, screenshots, or shared logs.
- Bootstrap env values have been removed from `.env.staging`.
- The staging bootstrap admin has existing seeded roles sufficient for dashboard access.
- `StagingSmokeOperator` is a DB-only staging drift role used for smoke coverage.
- `StagingSmokeOperator` is not in source guardrails or seed data.
- Before production, replace or remove `StagingSmokeOperator` through a formal RBAC role-design decision.

## Emergency Stop / No-Go Triggers

Consider stopping app access or limiting network access immediately if any of these occur:

- secret, token, password, cookie, or database URL appears in logs or shared output
- admin credential exposure is suspected
- DB backup exposure is suspected
- Docker container compromise is suspected
- Caddy routes the staging domain to an unintended upstream
- PostgreSQL host port exposure is discovered
- app is bound to `0.0.0.0:3334`
- important data entry begins before backup encryption/offsite policy is resolved
- anonymous-voting guardrail violation is suspected

Stop only the app if a rapid pause is needed:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml stop app
```

PostgreSQL data should be preserved. Do not delete containers, volumes, backups, or database data unless a separately approved cleanup/restore plan exists.

## Production Blockers

Before production or official external use:

- administrator MFA/WebAuthn
- KMS-backed field encryption or approved equivalent
- production secret manager
- provider integrations for email/SMS/Kakao/identity, with token-redaction tests
- report PDF/CSV/Excel generation
- npm audit moderate findings patched or formally accepted
- encrypted/offsite backup
- key custody/recovery policy
- recurring restore drills
- production RBAC role design
- Caddy/access-log redaction verification
- production monitoring/APM redaction verification
- retention/deletion policy
- terms of service, privacy policy, and legal review as applicable
