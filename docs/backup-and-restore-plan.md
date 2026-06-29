# Backup And Restore Plan

This plan records the current staging backup posture and the recommended hardening path. It does not contain secrets, database URLs, private keys, provider credentials, or backup contents.

## Current Staging Backup

- Environment: self-hosted staging at `https://voting.kryp.xyz`.
- Database: Docker Compose PostgreSQL on a private Docker network with no host port mapping.
- Local backup directory: `/mnt/data_4tb/voting-service-web/backups/`.
- Current backup format: gzip-compressed PostgreSQL custom-format dump (`.dump.gz`).
- Current encryption: none. Age-based encrypted backup setup is deferred for the current staging/internal beta phase.
- Current offsite target: manual, selected in Step 38 and deferred until the encryption/key-custody policy is revisited.
- Current offsite copy: none confirmed.
- Restore evidence: Step 35 restored the compressed backup into an isolated temporary PostgreSQL container with no host port exposure and validated schema/count/index sanity.
- Accepted current risk: local-only backup is acceptable only for staging/internal beta with non-production data, minimal sensitive personal data, no legal-effect voting, restricted server access, and backup file mode `600`.

## Tooling Status

- Host `gzip`: available.
- Host `gpg`: available.
- Host `rsync`: available.
- Host `pg_dump`: not available in PATH during Step 37.
- Docker PostgreSQL container `pg_dump`: available.
- Host `age`: not available in PATH. Age installation is deferred.
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

## Deferred Offsite Path

Age/offsite hardening is intentionally deferred for the current staging/internal beta phase because key custody and restore responsibility would be concentrated on the operator. Losing the private key would make encrypted backups unrecoverable.

Future production-readiness path:

1. Define key custody, recovery, and rotation policy before choosing an encryption tool.
2. Encrypt backups before offsite transfer.
3. Keep backup decryption material recoverable by the organization, not only one operator.
4. Copy only encrypted artifacts offsite.
5. Rehearse restore from the encrypted offsite artifact into a separate non-production database.

Do not put provider access keys, private keys, database URLs, or passwords in the repository, chat, issue trackers, or documents.

## Encryption Options

| Option | Strengths | Tradeoffs | Recommendation |
| --- | --- | --- | --- |
| `age` | Simple recipient-key file encryption; server needs only public key | Requires installing `age` and managing recipient/private key recovery | Recommended default |
| `gpg` | Already installed on the server; mature | Operational key management is more complex | Acceptable fallback |
| `openssl enc` | Usually available | Easy to misuse; passphrase handling is risky | Avoid unless wrapped carefully |
| Provider-side encryption | Simple with S3-like services | Provider can still access plaintext unless customer-managed keys are used | Use only as an additional layer |
| `rclone crypt` | Good for cloud/offsite remotes | Requires rclone config secret management | Good when using rclone-based storage |

Deferred encryption path:

- Do not install or adopt `age` for the current staging/internal beta phase.
- Do not generate or store an age private key on the staging server.
- Revisit encryption tooling and key custody before production.
- Test decrypt and restore in a temporary non-production PostgreSQL container before relying on encrypted backups.

## Automation Draft

Repository file `scripts/backup-postgres-staging.sh.example` is the reviewed template. Keep the real script server-local and untracked.

Recommended server-local setup:

- Copy the example to a non-repo operational path or keep it untracked in the repo checkout.
- `chmod 700` the script.
- Use Docker Compose backup mode so PostgreSQL remains unexposed.
- Write output to `/mnt/data_4tb/voting-service-web/backups/`.
- Leave `AGE_RECIPIENT` unset while encrypted backup setup is deferred.
- Use `OFFSITE_DRY_RUN=yes` until the offsite target and encryption/key-custody policy are confirmed.
- Never hardcode database passwords, provider secrets, private keys, or full database URLs in the script.

## Restore Requirements

Current verified path:

- local unencrypted gzip backup restore: passed once in Step 35.

Still pending before production:

- backup encryption policy.
- offsite backup policy.
- key custody, recovery, and rotation policy.
- encrypted backup creation.
- encrypted backup decrypt and restore rehearsal.
- offsite copy download and restore rehearsal.
- recurring restore drill schedule.
- backup retention policy.
- backup monitoring/alerting.

Production readiness requires an encrypted offsite backup that has been restored into a separate non-production database at least once.
