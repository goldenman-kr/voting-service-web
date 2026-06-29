# Implementation Status

This document records the implementation state after Step 36. It is not a product design replacement; it tracks what is implemented, what is still mocked or skeletal, and which guardrails must remain fixed before beta or production use.

## Completed Steps

- Step 0-1: Guardrail structure and tests for permissions, roles, authentication policy, election states, field exposure, and anonymous voting invariants.
- Step 1.6: Next.js App Router, TypeScript, Prisma, Tailwind, Vitest, and environment validation foundation.
- Step 2: ERD-based Prisma schema.
- Step 3: Domain policies for election state transitions, actions, authentication policy, ballots, result versions, audit requirements, and field exposure.
- Step 4: Server response/error helpers, admin session shape, RBAC helpers, step-up policy, audit/security event boundaries, and handler wrappers.
- Step 5-5.5: Voter authentication policy, invite token body exchange, voter session model, repository boundaries, and Prisma adapters.
- Step 6-6.5: Admin election setup, registry/invitation boundaries, state transition workflows, and audit boundaries.
- Step 7: Anonymous ballot submission and revote policy using client-held random ballot group token.
- Step 8: Result tally, ResultVersion, confirmation, publication, correction, invalidation, and report export metadata boundaries.
- Step 9: MVP admin/voter UI skeletons and static UI guardrail checks.
- Step 10: Mock/in-memory MVP flow tests, operational exception tests, audit coverage checks, privacy regressions, and UI smoke checks.
- Step 10.5: Local PostgreSQL Docker Compose development environment.
- Step 11: PostgreSQL migration, raw partial unique index for current ballots, RBAC seed, and DB integration test foundation.
- Step 12: Prisma repository integration and route adapter wiring for core MVP boundaries.
- Step 13-13.0: AdminSession/AdminStepUpGrant schema, DB-backed admin login/session, and step-up foundation.
- Step 14: Admin login UI, logout/me flow, protected admin routing, step-up UI skeleton, and safe admin bootstrap command.
- Step 15: Admin UI connection for election creation, questions/options, authentication policy, voter registry, and review request.
- Step 16: Voter UI connection for invite exchange, identifier verification, election info, ballot submission, revote, completion, and results.
- Step 17: Admin state transition CTA, reason capture, step-up checks, result tally/confirm/publish CTA, correction/invalidation skeletons, and invitation CTA boundaries.
- Step 18: Playwright browser E2E smoke test for the admin/voter MVP flow.
- Step 19: E2E test-data cleanup policy, release readiness checklist, development workflow notes, and npm audit review.
- Step 20: GitHub Actions CI guardrail verification for PostgreSQL migrations, seed, tests, typecheck, build, Playwright E2E, and E2E cleanup.
- Step 21: Remote CI first-run guidance, branch protection recommendation, PR template, and issue templates.
- Step 22: Local production-like rehearsal runbook, clean rehearsal DB migration/seed/bootstrap/start smoke, and production blocker recheck.
- Step 23: Production deployment plan, infrastructure options, managed PostgreSQL policy, secret management policy, migration approval procedure, logging redaction policy, and backup/restore/retention draft.
- Step 24: Internal beta staging target decision, managed platform comparison, Render staging plan, staging env/secret matrix, migration runbook, smoke/E2E strategy, and log redaction verification plan.
- Step 25: Render staging provisioning runbook, Render build/start command confirmation, migration execution checklist, secret generation guidance, smoke checklist, rollback/cleanup notes, and log leakage review checklist.
- Step 26: Render staging operator dry-run input sheet, final Web Service/Postgres/env values checklist, one-off job command order, smoke order, log leakage pattern checklist, and Go/No-go criteria.
- Step 27: Render staging flow stopped, internal beta staging target changed to self-hosted Linux server, self-hosted staging runbook added, Docker Compose staging need documented, and backup/restore/log redaction responsibilities moved to the operator-owned server model.
- Step 28: Self-hosted staging artifacts prepared locally, including Dockerfile, staging Compose draft, staging env example, reverse proxy examples, backup script example, and updated self-hosted runbook. Actual server pre-flight and deployment remain deferred.
- Step 29: Server pre-flight confirmed the self-hosted staging shape: user-managed Caddy proxies to `127.0.0.1:3334`, the app container binds only to that host-local port, and PostgreSQL remains private on the Docker network with no host port mapping.
- Step 30-32: Self-hosted staging was brought up at `https://voting.kryp.xyz` with Docker Compose app/PostgreSQL, migration deploy, RBAC seed, admin bootstrap, bootstrap env removal, HTTPS admin/voter smoke, RBAC staging admin repair, log leakage quick check, and a local compressed PostgreSQL backup snapshot.
- Step 33: Staging manual MVP voting smoke passed through admin election creation, question/options, voter registry import, review/approve/schedule/open, invitation prepare/send stub, invite/identify, ballot submit, revote, close/tally/confirm/publish, published result viewing, DB sanity checks, and app/PostgreSQL log leakage review.
- Step 34: Staging test-data inventory, cleanup policy, RBAC drift review, and restore rehearsal preparation were completed. No destructive cleanup was run.
- Step 35: Full restore rehearsal passed by restoring the compressed staging backup into an isolated temporary PostgreSQL container with no host port, validating schema/count/index sanity, and removing the temporary restore resources.
- Step 36: Failed Step 33 draft smoke elections were cleaned up from staging after backup confirmation. The successful published smoke election was preserved, and the DB-only `StagingSmokeOperator` role was retained as documented staging drift.

## Currently Working MVP Flow

- A local developer can start PostgreSQL with Docker Compose, apply Prisma migrations, seed RBAC data, bootstrap an initial admin, and run the app.
- An admin can log in, access protected admin pages, create an election draft, add questions/options, keep the MVP authentication policy at `invite_link_with_identifier`, import voters, request review, approve, schedule/open, prepare/send invitation stubs, close, tally, confirm, and publish results.
- A voter can use body-based invite token exchange, verify their identifier, view election information, submit an anonymous ballot, revote without reusing a previous Ballot row, see completion status without previous choices, and view published results when policy allows.
- Browser-level smoke coverage exists through Playwright and validates that sensitive token/internal identifiers are not exposed in the MVP path.

## Database And Migration Status

- PostgreSQL is the only supported local database for development and tests.
- Prisma migration has been generated and applied in the local development environment.
- The database includes the required partial unique index:

```sql
CREATE UNIQUE INDEX unique_current_ballot_per_group
ON ballots (anonymous_ballot_group_id)
WHERE is_current = true;
```

- DB integration tests are present, but they remain development-environment tests and are not a substitute for production migration rehearsal.
- E2E cleanup deletes only local test tenants named with the `E2E Smoke Tenant e2e-` prefix and refuses production/non-local database URLs.
- GitHub Actions runs the same migration, seed, test, build, E2E, and cleanup gates against an isolated PostgreSQL service named `voting_service_web_ci`.
- Remote GitHub Actions execution must be confirmed after push or pull request creation. Branch protection should require the `CI Guardrail Verification / Guardrails, DB, build, and E2E` check.
- A local production-like rehearsal was run against `voting_service_web_rehearsal` with migration deploy, RBAC seed, admin bootstrap, production build/start smoke, and Playwright E2E.
- Internal beta staging is provisioned on the self-hosted Linux server at `https://voting.kryp.xyz`.
- The staging app is bound only to `127.0.0.1:3334` behind user-managed Caddy. PostgreSQL is internal to Docker Compose and has no host port mapping.
- Staging migration deploy, RBAC seed, initial admin bootstrap, duplicate bootstrap block, bootstrap env removal, HTTPS admin login/session/logout/relogin smoke, and voter invite page smoke have passed.
- The bootstrap admin currently has `OrganizationOwner` plus `ElectionManager` in staging so the dashboard's `election.read` requirement is satisfied using existing seeded role mappings.
- The Step 33 staging smoke required a DB-only `StagingSmokeOperator` role because the seeded `ElectionManager` role intentionally forbids approval and result publication permissions. This role is retained only as staging drift for internal beta convenience and must be removed or replaced through a separate RBAC design step before production.
- Step 36 removed the two failed `ready_for_review` `Staging Smoke Vote step33-*` drafts from staging. The successful published smoke election remains as audit evidence.
- A compressed staging PostgreSQL backup snapshot exists under `/mnt/data_4tb/voting-service-web/backups/`. Gzip integrity, `pg_restore --list`, and full isolated restore rehearsal have passed. The rehearsal restored `voting-service-web-staging-20260629T141827Z.dump.gz` into a temporary PostgreSQL container and confirmed migrations, key tables, RBAC baseline counts, and `unique_current_ballot_per_group`.
- Render staging documents are archived as an alternative path only; no Render resource has been created.
- Production candidate remains AWS ECS/Fargate + RDS PostgreSQL or an equivalent managed container/app platform with managed PostgreSQL, KMS, secret store, backup/PITR, and redacted logging.
- No staging or production cloud resources have been created.

## Mock Or Skeleton Areas

- External delivery providers for email, SMS, Kakao, SSO, and identity verification are not implemented.
- Real MFA/WebAuthn is not implemented; step-up is represented by a password-confirmation based MVP boundary.
- Report file generation for PDF, CSV, and Excel is not implemented.
- KMS-backed field encryption, key rotation, and production secret-management adapters are not implemented.
- Backup/restore workflows are documented and have one successful staging restore rehearsal, but offsite backup, encryption-at-rest policy, and recurring restore drills remain pending.
- Advanced audit log search/export review UI is not implemented.
- DB emergency access workflow is documented and permissioned, but not implemented as an operational console.
- Incident management UI and advanced incident workflows remain skeletal.
- Production monitoring, APM redaction validation, and access-log redaction validation are not complete.
- Staging monitoring and reverse-proxy access-log redaction validation are planned but not complete. App/PostgreSQL log leakage quick checks passed for the bring-up smoke.
- Full restore rehearsal into a separate temporary PostgreSQL database passed once for the current staging snapshot. Recurring restore drills remain pending.
- Failed Step 33 staging draft cleanup is complete. The successful published smoke election remains as short-term staging evidence.
- Docker image build and staging Compose startup have been executed on the office Linux server.
- Production deployment target is planned at the architecture level but not provisioned.

## npm Audit Status

- `npm audit --json` currently reports 5 moderate findings.
- The reported chain includes Prisma development tooling and Next's bundled PostCSS dependency.
- The suggested `npm audit fix --force` path is not safe for this project because it proposes major-version or downgrade-style changes that could break the Next.js/Prisma stack.
- CI blocks high and critical audit findings with `npm audit --audit-level=high`, while the current moderate findings remain production-readiness blockers.
- No forced dependency change has been applied in Step 19 or Step 20.
- Before production, the team must either upgrade to patched compatible releases when available or record a formal risk acceptance with compensating controls.

## Guardrails That Must Not Be Relaxed

- Anonymous voting must not persistently link EligibleVoter, VotingCredential, User, VoterSession, or AnonymousVotingPass to Ballot, Vote, AnonymousBallotGroup, or SubmissionEvent.
- Invite tokens, ballot group tokens, session tokens, one-time codes, and raw sensitive personal data must not be stored in logs or API responses.
- Invite tokens must not be placed in URL path parameters.
- MVP voter authentication remains `invite_link_with_identifier`; code authentication is optional per election and disabled by default.
- Published results must not be overwritten. Corrections require a new ResultVersion and correction record; invalidation requires an invalidation record.
- Log export requires dual approval, step-up authentication, purpose, masking, export tracking, and AuditEvent recording.
- Production code must not depend on mock admin sessions.

## Release Blockers Before Production

- Replace all development secrets with production-grade secrets and managed secret storage.
- Add KMS-backed field encryption and key rotation.
- Implement and verify backup/restore, including encrypted backup storage and restore drills.
- Verify token/log redaction across application logs, access logs, reverse proxy logs, and APM.
- Decide production retention/deletion schedules and implement operational purge workflows.
- Resolve or formally accept current npm audit findings.
- Implement production-grade MFA/WebAuthn for administrators.
- Implement provider-specific delivery security before enabling email/SMS/Kakao/external identity integrations.
- Run production-like migration rehearsal and rollback planning.
- Keep `docs/production-like-rehearsal-runbook.md` current as the pre-deployment rehearsal procedure evolves.
- Follow `docs/production-deployment-plan.md` before selecting a production platform or creating infrastructure.
- Follow `docs/staging-deployment-plan.md` before provisioning internal beta staging.
- Follow `docs/self-hosted-staging-runbook.md` during self-hosted staging provisioning.
- Configure GitHub branch protection for `main` so CI guardrails are required before merging.

## Beta-Test Readiness

- Local beta or internal dry-run testing is possible if it uses non-production data, local PostgreSQL, and the current documented limitations.
- Beta runs must not rely on legal-effect voting, external identity proofing, real SMS/Kakao delivery, production report exports, or production backup/restore guarantees.
- Small anonymous election result publication controls must stay conservative because statistical re-identification risk remains.

## Recommended Next Steps

- Push the branch or open a pull request and confirm the first remote `CI Guardrail Verification` run.
- Configure branch protection for `main` after the first remote CI run succeeds.
- Provision the internal beta staging target only after approval, using `docs/staging-deployment-plan.md`.
- Use `docs/self-hosted-staging-runbook.md` as the execution checklist for self-hosted staging.
- Before self-hosted provisioning, complete the pre-flight checklist without writing real secrets to docs or chat.
- Move staging backups to encrypted offsite storage and schedule recurring restore drills before relying on beta data long-term.
- Keep `https://voting.kryp.xyz` staging limited to non-production or explicitly approved low-risk beta data until monitoring, offsite/encrypted backups, recurring restore drills, and remaining production blockers are addressed.
- Add provider-specific delivery adapters only after token redaction tests exist for each provider.
- Add real MFA/WebAuthn before any production administrator access.
