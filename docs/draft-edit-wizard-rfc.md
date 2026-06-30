# Draft Edit Wizard RFC

Status: proposed for UX-4B

Scope: `/admin/elections/[election_id]/edit` 통합 편집 마법사를 구현하기 전, Draft 상태 투표의 안전한 수정 정책과 server action 설계를 고정한다. 이 문서는 Prisma schema, migration, staging, production DB, Caddy 설정 변경을 포함하지 않는다.

## 1. Current Update Capability

| Area | Existing function/action | Current capability | History/Audit | Safe for wizard now | Notes |
| --- | --- | --- | --- | --- | --- |
| Basic election info | `updateElectionDraft` service, route handler only | title, description, electionType, votingMode, noticeStartsAt, startsAt, endsAt, timezone partial update | `ElectionChangeHistory` and AuditEvent `election.updated` | Yes, with new server action wrapper | Current admin UI does not expose a server action for this yet. |
| Question create | `createQuestion`, `createQuestionWithOptionsAction` | create active question | AuditEvent `question.created` | Limited | Current create action supports adding a question with textarea options. Wizard should initially target the existing first question. |
| Question update | `updateQuestion` service, route handler only | title, description, type, required, min/max, displayOrder partial update | AuditEvent `question.updated` | Yes, for existing question title/description | No admin server action yet. Avoid type/min/max changes in first wizard unless product needs them. |
| Option create | `createOption`, `createQuestionWithOptionsAction` | create active option | AuditEvent `option.created` | Yes, for append-only Draft options | Need displayOrder assignment after existing active options. |
| Option update | `updateOption` service, route handler only | label, description, displayOrder partial update | AuditEvent `option.updated` | Yes, for label/description only | Reordering touches displayOrder uniqueness and should be deferred. |
| Option delete | None | Not supported | N/A | No | Must not simulate deletion by direct DB update in wizard. |
| Question delete | None | Not supported | N/A | No | Must not archive/delete questions in first edit wizard. |
| Auth policy | `configureAuthenticationPolicy`, `configureAuthenticationPolicyAction` | MVP-available method upsert | AuditEvent `authentication_policy.updated` | Yes | UI should keep internal method names hidden. |
| Voter registry import | `importEligibleVoters`, `importVoterRegistryAction` | appends/imports rows into election-owned registry and creates active `EligibleVoter` records | AuditEvent `voter_registry.imported`; validation errors stored without raw value | Limited | Not a true replacement. Duplicate external identifiers are rejected. |
| Voter registry replace | None | Not supported | N/A | No | Needs explicit policy for disabling old eligible voters and credential/invitation impact. |
| Invitation/credential prepare | `prepareInvitationsForElection`, `issueInvitations`, `resendInvitation` | creates invitations and voting credentials after registry is ready | AuditEvents for preparation/send | Not edit | Once created, registry replacement becomes high risk. |
| State transition | `requestElectionReview`, approve/schedule/open/pause/resume/close actions | allowed transitions only | `ElectionStateHistory` and AuditEvent | Not edit | State changes must stay separate from edit wizard save. |

## 2. State-Based Edit Policy

Recommended policy for UX-4B and the first implementation pass:

| State | Basic info | Question/option | Voter registry | Auth policy | Required handling |
| --- | --- | --- | --- | --- | --- |
| Draft | Allow | Allow conservative edits | Allow append import only; replacement deferred | Allow MVP methods | Use service functions, permission checks, validation, history/audit. |
| ReadyForReview | Do not edit directly | Do not edit directly | Do not edit directly | Do not edit directly | Add an explicit review rejection/rollback path to Draft first. Current domain policy says reason-based edit is possible, but UX should not encourage direct edits. |
| Approved | Deny | Deny | Deny | Deny | Require a future "reopen as Draft" policy with state history and notification impact. |
| Scheduled | Deny | Deny | Deny | Deny | Require rollback/cancel schedule policy before edits. |
| Notice | Deny | Deny | Deny | Deny | Treat as voter-facing pre-open state; edits can confuse notified voters. |
| Open | Deny | Deny | Deny | Deny | Use pause/close/incident/invalidation flows only. |
| Paused | Deny | Deny | Deny | Deny | Paused is still active election operation; no setup edits. |
| Closed | Deny | Deny | Deny | Deny | Result/tally flow only. |
| Published | Deny | Deny | Deny | Deny | Published overwrite remains forbidden; use correction/invalidation only. |

Implementation note: keep domain action policy conservative in UI. Even though `ELECTION_ACTION_POLICY` currently lists `ReadyForReview` edits as `REQUIRES_REASON`, the integrated wizard should restrict itself to Draft until a formal "return to Draft" workflow is implemented.

## 3. Question And Option Edit Policy

First implementation should use a conservative "no destructive edit" rule:

| Operation | Draft policy | Reason |
| --- | --- | --- |
| Question title update | Allow | Existing service and schema support it. |
| Question description update | Allow | Existing service and schema support it. |
| Question type/min/max/required update | Defer | Can alter ballot validation semantics. |
| Existing option label update | Allow | Existing service and schema support it. |
| Existing option description update | Allow | Existing service and schema support it. |
| Option append | Allow if total options remains valid and labels are unique | Existing create service supports it and it does not rewrite existing choices. |
| Option delete/archive | Defer | No service/repository method; deletion can affect display order and future result semantics. |
| Option reorder | Defer | `@@unique([questionId, displayOrder])` requires careful swap strategy and audit summary. |
| Question delete/archive | Defer | No service/repository method and may require cascading option handling. |

Validation for first wizard:

- At least one active question.
- For non-free-text question, at least two active options after applying append/update.
- Option labels unique case-insensitively within the question.
- Text fields use existing max lengths from `validation.ts`.
- Do not display or accept Ballot/Vote/AnonymousBallotGroup IDs.

## 4. Voter Registry Edit And Replacement Policy

Current registry model is election-owned: `VoterRegistry.electionId @unique`. Import creates `VoterRegistryImport` records and active `EligibleVoter` rows. It does not have an import version pointer or a safe "replace all eligible voters" operation.

| Situation | Recommended policy | Reason |
| --- | --- | --- |
| Draft and no invitations/credentials exist | Allow additional import; replacement requires new implementation | Current import can append non-duplicate voters safely. True replacement must disable old voters and update counts atomically. |
| Draft after invitations or credentials exist | Deny replacement; allow no edit by default | Invitations and credentials are tied to eligible voter records. Replacing the registry can orphan or invalidate prepared access. |
| Approved/Scheduled/Notice | Deny registry edit | Voter-facing or approved setup should not drift silently. |
| Open/Paused/Closed/Published | Deny registry edit | It can change eligibility after voting has started or ended. |

Future replacement design should:

- Never delete raw rows blindly.
- Prefer a transaction that archives old `EligibleVoter` rows and creates new rows, or introduces explicit import versioning in a later schema phase.
- Block replacement if any invitation, voting credential, voter session, anonymous pass, ballot, or result exists.
- Record `ElectionChangeHistory` with counts only, never raw PII.
- Record AuditEvent with reason and row counts only.
- Keep validation errors generic and row-number based.

## 5. Integrated Edit Wizard UX Design

Route:

- Preferred: `/admin/elections/[election_id]/edit`
- Alternative: reuse `CreateElectionWizardForm` with a `mode="edit"` prop once server action design is fixed.

Flow:

| Step | Purpose | Prefill | Editable in first pass | Disabled/deferred |
| --- | --- | --- | --- | --- |
| 1. Basic info | Confirm voter-facing title, description, type, schedule | `AdminElectionDetail` base fields | title, description, electionType, startsAt, endsAt | votingMode changes should be deferred unless explicitly needed. |
| 2. Question/choices | Edit first question and options without destructive operations | active question/options ordered by displayOrder | question title/description, existing option label/description, append option | delete option, delete question, reorder, type changes. |
| 3. Voter registry/auth | Confirm registry and authentication settings | registry counts, current auth method | auth policy MVP method; optional append-only registry import if no prepared invitations/credentials | registry replacement, shared registry, photo upload. |

Navigation:

- `취소` returns to detail without save.
- `저장` submits the whole wizard only in Draft.
- Save success redirects to `/admin/elections/[election_id]`.
- Forbidden state shows a friendly message and returns to detail.
- UI text must say "투표", "선거인 명부", "투표 참여 인증 방식", "선택 항목".

Prefill strategy:

- Load `getAdminElectionDetail()` in a server page.
- Pass only safe fields to a client form.
- Do not pass token hashes, encrypted PII, voter IDs, ballot IDs, vote IDs, anonymous group IDs, or raw invitation data.

## 6. Server Action Design

Candidate action name: `updateElectionWizardAction`.

Candidate input shape:

```ts
type UpdateElectionWizardInput = {
  electionId: string;
  basic: {
    title: string;
    description?: string;
    electionType: "representative_election" | "yes_no_agenda" | "multiple_choice_agenda" | "opinion_collection";
    startsAt: string;
    endsAt: string;
  };
  question: {
    id: string;
    title: string;
    description?: string;
    options: Array<{
      id?: string;
      label: string;
      description?: string;
    }>;
  };
  authPolicy?: {
    method: string;
  };
  voterRegistryAppendRows?: string;
};
```

Required checks:

- Restore current admin session.
- Require `election.read`, then load detail in organization scope.
- Reject unless `state === draft`.
- Reject if server `now >= startsAt` and the edit would change questions/options/registry.
- Require relevant permissions before each area:
  - base info: `election.update`
  - question/options: `question.write`
  - auth policy: `auth_policy.write`
  - registry append: `voter_registry.import`
- Validate required fields, date order, option count, duplicate labels, and registry row shape.
- Reuse existing service functions:
  - `updateElectionDraft`
  - `updateQuestion`
  - `updateOption`
  - `createOption`
  - `configureAuthenticationPolicy`
  - `importEligibleVoters` only for append-safe cases
- Do not directly update Prisma from the server action except through existing service/repository APIs.
- Do not implement delete/reorder/replacement in this action.

Audit/history expectations:

- `updateElectionDraft` already records `ElectionChangeHistory` and AuditEvent.
- `updateQuestion` and `updateOption` currently record AuditEvent but not `ElectionChangeHistory`.
- `createOption` records AuditEvent.
- `configureAuthenticationPolicy` records AuditEvent.
- `importEligibleVoters` records AuditEvent with counts and validation errors.
- If a single wizard save changes multiple areas, add a future high-level summary AuditEvent only if it does not duplicate sensitive values.

Transaction strategy:

- First implementation may call service functions sequentially and stop on first failure.
- A later service-level orchestration should wrap multi-area edits in a transaction-like repository boundary if partial saves become confusing.
- Do not hide partial failure. Return a friendly generic message and leave detailed diagnostics in server-side safe logs.

## 7. Risks And Follow-Up Tasks

| Risk | Handling |
| --- | --- |
| ReadyForReview reason-based edits exist in domain policy | UI should block integrated wizard outside Draft until rollback policy exists. |
| Registry append is not replacement | Label it clearly. True replacement is a separate phase. |
| Existing import rejects duplicates but does not deactivate missing voters | Do not call it "교체". |
| Option append can alter voter-facing content after review if allowed outside Draft | Draft-only guard required. |
| Option reorder may violate unique displayOrder during swaps | Defer and design transactional reorder. |
| Deleting question/option can affect result semantics | Defer until archive/delete service with audit exists. |
| `targetId` in AuditEvent may store internal IDs | Audit log is internal; UI must not display these IDs. |

## 8. Recommended Implementation Order

1. Add route skeleton `/admin/elections/[election_id]/edit` with Draft-only guard and safe prefill.
2. Add `updateElectionBasicInfoAction` or the basic-info slice of `updateElectionWizardAction`.
3. Add question title/description and existing option label/description update.
4. Add append-only option support.
5. Add auth policy selection reuse.
6. Decide whether append-only registry import belongs in the wizard or remains on the registry page.
7. Design destructive edits separately: option delete/archive, question delete/archive, reorder, and registry replacement.

## 9. Guardrail Checklist

- No Prisma schema or migration change.
- No Caddy, staging, or production DB access.
- No token, session, DB URL, hash, encrypted PII, Ballot/Vote/AnonymousBallotGroup ID in UI.
- No voter-to-choice linkage in admin view.
- No Open/Paused/Closed/Published edits.
- No Published result overwrite.
- No permission check bypass.

## 10. Implementation Status Through UX-4G

Implemented:

- `/admin/elections/[election_id]/edit` Draft-only route guard and safe prefill.
- Step 1 basic information update through `updateElectionDraft`.
- Step 2 conservative question/option editing through `updateQuestion`, `updateOption`, and append-only `createOption`.
- Step 3 MVP authentication method update through `configureAuthenticationPolicy`.
- Voter registry summary and link to the existing registry management page.
- Completion guidance and pre-review readiness summary on the election detail page.
- Final PR-readiness pass for wording consistency, route/CTA checks, source guardrail scan, and static UI guardrails.

Deferred:

- question/option delete, archive, and reorder,
- voter registry replacement, shared registry, and registry clone policy,
- option photos and media storage,
- ReadyForReview rollback/direct-edit workflow,
- schema changes for additional voter identity fields,
- username login, IP lockout, no-revote policy changes, public election listing, and vote-select-then-auth flow.
