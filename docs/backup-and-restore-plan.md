# Backup And Restore Plan

This plan records the current staging backup posture and the recommended hardening path. It does not contain secrets, database URLs, private keys, provider credentials, or backup contents.

## Current Staging Backup

- Environment: self-hosted staging at `https://voting.kryp.xyz`.
- Database: Docker Compose PostgreSQL on a private Docker network with no host port mapping.
- Local backup directory: `/mnt/data_4tb/voting-service-web/backups/`.
- Current backup format: gzip-compressed PostgreSQL custom-format dump (`.dump.gz`).
- Current encryption: none.
- Current offsite copy: none confirmed.
- Restore evidence: Step 35 restored the compressed backup into an isolated temporary PostgreSQL container with no host port exposure and validated schema/count/index sanity.

## Tooling Status

- Host `gzip`: available.
- Host `gpg`: available.
- Host `rsync`: available.
- Host `pg_dump`: not available in PATH during Step 37.
- Docker PostgreSQL container `pg_dump`: available.
- Host `age`: not available in PATH during Step 37.
- Host `rclone`: not available in PATH during Step 37.

The staging backup script example defaults to Docker Compose `pg_dump` so the server does not need to expose PostgreSQL or install host PostgreSQL client tools.

## Offsite Backup Options

| Option | Cost | Setup | Encryption Fit | Restore Fit | Staging Fit | Production Fit |
| --- | --- | --- | --- | --- | --- | --- |
| Different local disk/NAS mount + `rsync` | Low if already owned | Low | Requires file encryption before copy | Simple if mount is available | Good first step | Useful but not enough alone |
| Separate server + `rsync` over SSH | Low to medium | Medium | Requires file encryption before copy | Good if SSH access is reliable | Good | Good with monitoring and key rotation |
| S3-compatible storage | Low to medium | Medium | Good with client-side encryption; provider-side encryption optional | Good with lifecycle/versioning | Good | Strong |
| Backblaze B2 | Low | Medium | Good with client-side encryption or `rclone crypt` | Good | Good | Strong for cost-sensitive offsite |
| Cloudflare R2 | Low egress cost | Medium | Good with client-side encryption or `rclone crypt` | Good | Good | Strong |
| AWS S3 | Medium | Medium | Good with client-side and provider-side encryption | Excellent with IAM/lifecycle | Acceptable | Strong |
| Google Drive via `rclone` | Low | Medium | Use `rclone crypt` or pre-encrypt files | Adequate | Acceptable | Weaker operational fit |
| Manual download | Low | Low | Pre-encrypt file first | Human-dependent | Temporary only | Not sufficient |

## Recommended Offsite Path

Recommended staging path:

1. Encrypt each backup locally with `age` using an operator-owned public recipient key.
2. Keep the matching private key off the staging server.
3. Copy only encrypted artifacts offsite.
4. Start with a mounted NAS or separate server via `rsync` if one already exists.
5. Move to S3-compatible storage with lifecycle/versioning when beta data volume or retention needs grow.

Do not put provider access keys, private keys, database URLs, or passwords in the repository, chat, issue trackers, or documents.

## Encryption Options

| Option | Strengths | Tradeoffs | Recommendation |
| --- | --- | --- | --- |
| `age` | Simple recipient-key file encryption; server needs only public key | Requires installing `age` and managing recipient/private key recovery | Recommended default |
| `gpg` | Already installed on the server; mature | Operational key management is more complex | Acceptable fallback |
| `openssl enc` | Usually available | Easy to misuse; passphrase handling is risky | Avoid unless wrapped carefully |
| Provider-side encryption | Simple with S3-like services | Provider can still access plaintext unless customer-managed keys are used | Use only as an additional layer |
| `rclone crypt` | Good for cloud/offsite remotes | Requires rclone config secret management | Good when using rclone-based storage |

Recommended encryption path:

- Use `age` for backup file encryption.
- Store only the `age` public recipient on the staging server.
- Store the private key outside the staging server in an operator-controlled secret store.
- Test decrypt and restore in a temporary non-production PostgreSQL container before relying on encrypted backups.

## Automation Draft

Repository file `scripts/backup-postgres-staging.sh.example` is the reviewed template. Keep the real script server-local and untracked.

Recommended server-local setup:

- Copy the example to a non-repo operational path or keep it untracked in the repo checkout.
- `chmod 700` the script.
- Use Docker Compose backup mode so PostgreSQL remains unexposed.
- Write output to `/mnt/data_4tb/voting-service-web/backups/`.
- Set `AGE_RECIPIENT` only after the operator provides a real public recipient key.
- Use `OFFSITE_DRY_RUN=yes` until the offsite target is confirmed.
- Never hardcode database passwords, provider secrets, private keys, or full database URLs in the script.

## Restore Requirements

Current verified path:

- local unencrypted gzip backup restore: passed once in Step 35.

Still pending:

- encrypted backup decrypt and restore rehearsal.
- offsite copy download and restore rehearsal.
- recurring restore drill schedule.
- backup retention policy.
- backup monitoring/alerting.

Production readiness requires an encrypted offsite backup that has been restored into a separate non-production database at least once.
