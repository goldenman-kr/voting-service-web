# voting-service-web
Multi-purpose online voting service

## Local initial admin bootstrap

Run RBAC seed first, then set one-time bootstrap environment values in your local `.env`.

Required values:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_TENANT_NAME`
- `BOOTSTRAP_ORGANIZATION_NAME`

Then run:

```bash
npm run db:seed
npm run admin:bootstrap
```

The bootstrap command stores only the password hash and blocks recreation when an admin already exists. In production, it also requires `BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN`.

## Self-hosted staging handoff

Before provisioning the office Linux staging server, start from `docs/server-agent-handoff.md`. It links the current MVP implementation state to the server-side pre-flight, Docker Compose staging draft, reverse proxy examples, and backup/runbook checklist.
