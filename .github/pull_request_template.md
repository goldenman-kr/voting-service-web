## Summary

-

## Scope

- [ ] Documentation only
- [ ] Tests only
- [ ] UI
- [ ] API/server
- [ ] Database/schema/migration
- [ ] Security/privacy/guardrail

## Guardrail impact

- [ ] No change to anonymous voting linkage rules
- [ ] No Ballot/Vote/AnonymousBallotGroup identifiers exposed in API or UI
- [ ] No token, code, session, IP, User-Agent, or raw PII added to logs/responses
- [ ] No invite token in URL path
- [ ] No Published result overwrite path
- [ ] No production mock admin session dependency

## Database

- [ ] No schema or migration change
- [ ] Migration added and reviewed
- [ ] Raw SQL guardrails reviewed, including current ballot partial unique index if relevant

## Testing

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run db:validate`
- [ ] `npm run db:generate`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Other:

## UI evidence

Add screenshots or notes for UI changes.

## Remaining risks

-
