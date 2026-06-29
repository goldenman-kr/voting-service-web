# Production-like Rehearsal Runbook

This runbook describes a local production-like rehearsal. It must not use production secrets, production databases, external delivery providers, or cloud infrastructure.

## Rehearsal Boundary

- Database: local PostgreSQL database named `voting_service_web_rehearsal`.
- Runtime: production build and `next start`.
- Environment: production-like values with dummy secrets.
- External providers: disabled.
- Cleanup: manual and explicit only.
- Deployment: out of scope.

Do not run this rehearsal against a production database. Do not put production secrets into shell history, `.env`, CI logs, or runbook examples.

## Required Environment Values

Use local dummy values with at least 32 characters for secret-like fields:

```bash
export DATABASE_URL="postgresql://voting_app:voting_app_dev_password_only@localhost:5432/voting_service_web_rehearsal?schema=public"
export APP_URL="http://127.0.0.1:3200"
export SESSION_SECRET="rehearsal-dummy-session-secret-32chars"
export ENCRYPTION_KEY="rehearsal-dummy-encryption-key-32chars"
export HMAC_KEY="rehearsal-dummy-hmac-key-32chars"
export BOOTSTRAP_ADMIN_EMAIL="rehearsal-admin@example.test"
export BOOTSTRAP_ADMIN_PASSWORD="replace-with-a-local-rehearsal-password"
export BOOTSTRAP_TENANT_NAME="Rehearsal Tenant"
export BOOTSTRAP_ORGANIZATION_NAME="Rehearsal Organization"
export BOOTSTRAP_ADMIN_ROLE="OrganizationOwner"
```

When `NODE_ENV=production`, bootstrap requires:

```bash
export BOOTSTRAP_CONFIRM="CREATE_INITIAL_ADMIN"
```

## Database Preparation

Create a clean local rehearsal database from the Docker PostgreSQL container:

```bash
docker compose exec -T postgres psql -U voting_app -d postgres -c "DROP DATABASE IF EXISTS voting_service_web_rehearsal;"
docker compose exec -T postgres psql -U voting_app -d postgres -c "CREATE DATABASE voting_service_web_rehearsal;"
```

These commands are destructive for the local rehearsal database only. Never point them at production.

## Migration And Seed

Validate and generate Prisma client:

```bash
npm run db:validate
npm run db:generate
```

Deploy migrations:

```bash
npx prisma migrate deploy
```

Seed RBAC data:

```bash
npm run db:seed
```

Confirm the current ballot partial unique index exists:

```bash
docker compose exec -T postgres psql \
  -U voting_app \
  -d voting_service_web_rehearsal \
  -tAc "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'unique_current_ballot_per_group';"
```

Expected index:

```sql
CREATE UNIQUE INDEX unique_current_ballot_per_group
ON public.ballots USING btree (anonymous_ballot_group_id)
WHERE (is_current = true)
```

## Initial Admin Bootstrap

Run bootstrap after migration and seed:

```bash
NODE_ENV=production npm run admin:bootstrap
```

Expected first run:

- Creates one admin user.
- Stores only password hash, not password plaintext.
- Requires `BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN`.

Expected second run:

- Skips with `admin_already_exists`.
- Does not create a second owner/admin.

## Build And Start

Build the production artifact:

```bash
npm run build
```

Start the app:

```bash
NODE_ENV=production npm run start -- --hostname 127.0.0.1 --port 3200
```

Smoke targets:

- `http://127.0.0.1:3200/admin/login`
- `http://127.0.0.1:3200/voter/invite`

The current cookie policy uses `Secure`, `HttpOnly`, and `SameSite=Strict`. Localhost browser testing may behave differently from HTTPS production hosting. Do not weaken cookie security for rehearsal; document any browser-specific issue instead.

## E2E Rehearsal

The existing Playwright smoke can be reused with the rehearsal database:

```bash
CI=true npm run test:e2e
npm run test:e2e:clean
```

The E2E fixture cleanup only removes tenants named with the `E2E Smoke Tenant e2e-` prefix and refuses production/non-local database URLs.

## Failure Triage

- Migration fails: inspect `prisma/migrations/**/migration.sql`, PostgreSQL version, and `DATABASE_URL`.
- Seed fails: confirm migrations were applied and permission/role codes still match guardrails.
- Bootstrap fails: confirm seed ran, password length is at least 12 characters, and `BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN` is set when `NODE_ENV=production`.
- Build fails: inspect TypeScript and Next.js route errors before changing runtime config.
- Start fails: confirm port availability and all required env values.
- E2E fails: check app start logs, cookie behavior on localhost, seeded test data, and cleanup safety checks.
- Partial unique index missing: stop; do not proceed to production-like smoke.

## Cleanup

For E2E data only:

```bash
npm run test:e2e:clean
```

To remove the entire local rehearsal database after the exercise:

```bash
docker compose exec -T postgres psql -U voting_app -d postgres -c "DROP DATABASE IF EXISTS voting_service_web_rehearsal;"
```

Do not automate broad destructive cleanup without an explicit confirmation gate.

## Backup And Rollback Preconditions

Before production migration:

- Take a database backup immediately before migration.
- Verify backup encryption and access control.
- Preserve audit/security logs before and after migration.
- Rehearse restore against a non-production database.
- Record the deployed migration version.
- Prepare a manual rollback plan. Prisma Migrate does not provide automatic production rollback.
- Define how to handle irreversible migrations before applying them.
- Confirm retention/deletion policies before collecting production voter data.

## Production Differences

- Production must use HTTPS; local rehearsal uses HTTP.
- Production must use managed secrets; rehearsal uses dummy values.
- Production must use managed PostgreSQL and backup/restore; rehearsal uses Docker PostgreSQL.
- Production must validate application/access/APM log redaction; rehearsal does not prove external log behavior.
- Production external providers remain disabled until provider-specific redaction and delivery tests exist.

## Production Blockers Rechecked

- MFA/WebAuthn is not implemented.
- KMS-backed field encryption is not implemented.
- External email/SMS/Kakao/identity providers are not implemented.
- PDF/CSV/Excel report file generation is not implemented.
- Backup/restore automation is not implemented.
- Production log/APM/access-log redaction is not verified.
- `npm audit` still reports moderate findings.
- Legal-effect voting is not supported.
- Terms of service and privacy policy may be required before real organization/user data is processed.
