# UX Remodeling Impact Plan

This plan compares the requested UX remodel with the current MVP implementation.
It intentionally avoids schema changes, migrations, staging operations, Caddy changes,
secret access, and production database access.

## UX-0 Impact Analysis

| Requirement | Current implementation | Needed change | Schema needed | Guardrail concern | Difficulty | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| Landing page with voter/admin entry | `src/app/page.tsx` is now a portal landing draft | Refine copy, entry CTAs, trust explanation | No | Must not imply unsupported public election listing | Low | UX-1 |
| Common top menu | `PublicNav` exists for public/voter entry; admin shell has side navigation | Keep home/voter/admin entry visible on public pages and admin shell | No | Do not expose admin-only state publicly | Low | UX-1 |
| Admin login email to username | Admin login route and UI submit `email`; user identity uses email-hash based lookup | Auth payload, bootstrap, credential handoff, repository lookup, validation copy | Likely yes | Account enumeration and admin credential handoff impact | Medium | UX-6/7 |
| Admin login 5 failures IP block | Login records security events and generic errors; no IP lockout store | Hashed or masked IP rate-limit store and auth service checks | Likely yes | Raw IP storage/logging policy, NAT/shared IP lockout risk | High | UX-6/7 |
| Voter auth 5 failures IP block | Identifier failure controls exist around credential/session attempts; no IP-level block | Voter-safe rate limit independent of voter existence | Likely yes | Must not reveal whether voter exists; raw IP should not be stored | High | UX-6/7 |
| Voter registry fields: unit, name, phone last 4, birth date | Current import accepts name, external identifier, email; PII is encrypted/HMACed generically | New field mapping, validation, HMAC search strategy, masking rules | Yes | Raw PII storage, field exposure, search HMAC design | High | UX-7 |
| Preset voter registry selection | Registry is election-owned via `VoterRegistry.electionId @unique` | Shared registry model, election-to-registry relation or clone workflow | Yes | Used-registry immutability and PII minimization | High | UX-4/7 |
| Used registry edit lock and clone | Current registry is tied to one election and imported through election setup | Need usage detection, clone command, edit permissions | Likely yes | Must not mutate a registry used by an active/completed election | High | UX-4/7 |
| Option card input instead of line textarea | Current question/option setup already stores options as rows, but creation flow is split across pages | Wizard UI can create row/card controls using existing option APIs | No | Start-after edit restrictions remain | Medium | UX-3 |
| Option description | `Option.description` exists in Prisma; current list/detail often only shows label | Extend forms/actions/UI to accept and render description | No | Description may include candidate PII; display intentionally | Medium | UX-3 |
| Option photo | No option media/storage model | Storage, upload, scan, access-control, metadata, cleanup | Yes | Metadata leakage and private media access control | High | UX-7 |
| Submit then no edit | Current `ElectionPolicy.allowRevote` defaults true and revote API exists | Policy decision, UI copy, ballot service behavior, tests | Maybe no if policy reused | Conflicts with current MVP flow and INV-07 revote history model | High | UX-6 |
| Block completed voter from ballot | Current voter completion supports revote when policy permits | Enforce `allowRevote=false` or per-election policy | No if policy reused | Must not remove history/audit semantics silently | Medium | UX-6 |
| Public ongoing/completed election list | Current voter flow starts from invite token exchange | New public/voter listing and eligibility-before-session design | Likely API/schema | Could expose closed-registry election metadata | High | UX-5/7 |
| Result check before voter auth | Current result page uses voter session or public result endpoint | Completed election selection plus safe result-auth flow | API likely | Must not expose voter/election eligibility or individual choices | High | UX-5/7 |
| Invite-token flow vs vote-select-then-auth | Current flow is invite token -> voter session -> identify -> election/ballot | New flow requires election discovery before voter session | API/schema likely | Invite token must still never appear in URL/log/response | High | UX-5/7 |
| Admin dashboard metrics | Dashboard reads election aggregates | Add clearer counts and registry count | No | Aggregate only; no voter choices | Low | UX-1 |
| Election list status sections | Current table was flat | Group setup/upcoming, active, completed | No | Aggregate only | Low | UX-1/2 |
| Election create wizard | Current flow creates election, then separate question/registry/auth pages | Client wizard using existing create and setup actions | Partial | Must block edits after start/open | Medium | UX-3 |
| Election edit wizard | Current detail subpages support setup operations; no wizard edit mode | Draft/pre-start edit flow with prefill | No/partial | Must not edit options/registry after start | Medium | UX-4 |
| Caddy/staging operations | Out of app repo scope and user-managed | No Caddy access or staging restart in this UX phase | No | Operational guardrail | N/A | None |

## Existing Structure Notes

- Admin data comes from DB-backed server helpers under `src/server/elections/admin-election-view.ts`.
- Admin pages already require a restored admin session and Permission checks through protected layout/service helpers.
- Voter pages currently require invite exchange and voter session state; there is no public voter dashboard backed by a safe election listing API.
- `Option.description` exists, but option image upload and shared voter registry presets do not.
- `ElectionPolicy.allowRevote` already exists. Changing default behavior to "no edit after submit" should be a policy decision, not a UI-only wording change.

## Guardrail Conflicts Or Cautions

| Requirement | Conflict or caution | Recommended handling |
| --- | --- | --- |
| "Submit cannot be edited" copy | Current MVP supports revote and official tally uses last current accepted ballot | Do not claim no-edit globally until `allowRevote` policy is changed or surfaced per election |
| Public voter dashboard with ongoing/completed lists | Current invite-token flow prevents broad election discovery | Design an API that exposes only safe public metadata or require invite/auth first |
| Vote-select-then-auth flow | Reverses current security boundary where invite is verified before election info/ballot access | Treat as new product flow requiring API and disclosure review |
| IP block | Raw IP retention can conflict with log/PII minimization | Store HMAC/masked IP with retention policy and generic errors |
| Username login | Existing admin handoff and lookup are email-based | Separate auth identity design from label-only UI copy |
| Registry fields | Unit/phone/birth fields are stronger PII than current generic external ID | Define encryption/HMAC/search/masking before migration |
| Option photos | Storage can leak metadata or private candidate material | Defer until storage, access, scanning, and retention are designed |

## UX-1 Page Flow Redesign

### Administrator Flow

| Screen | Purpose | Main user | User action | Inputs | Required guidance | Next screen | Empty/error state | Difficulty | Needed changes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Portal entry | Admin/Voter | Choose admin or voter path | None | Invite-based MVP, secret/token protection, open-source placeholder | `/voter` or `/admin` | Explain invite-only MVP | Low | UI only |
| `/admin/login` | Admin authentication | Admin | Sign in | Email/password today | Generic failure, no account detail | `/admin` | Generic error | Low now, high for username/IP block | UI now, API/schema later |
| `/admin` | Operational dashboard | Admin | See status and next action | None | Counts are aggregate; no voter choices | `/admin/elections` or new election | Empty election guidance | Low | UI + aggregate query |
| `/admin/elections` | Manage elections | Admin | Choose election or create | None | State controls what can be changed | Detail/new | Empty list guidance | Low | UI grouping |
| `/admin/elections/new` | Create draft | Manager | Enter base election data | Title, type, schedule | Starts/ends restrict editing later | Detail setup pages | Validation messages | Medium | Wizard later |
| `/admin/elections/[id]` | Inspect and operate | Manager/Approver | Continue setup or state action | Reasons for operations | No option/registry edits once open | Subpages/results | Permission/state errors | Medium | Existing actions reused |
| `/admin/elections/[id]/questions` | Configure options | Manager | Add/update questions/options | Question title, option labels today | Option descriptions possible; photos deferred | Detail/auth/registry | Validation messages | Medium | UI/action extension later |
| `/admin/elections/[id]/voters` | Manage allowed voters | Manager | Import/validate registry | Current name/external id/email | PII masked; used registry lock later | Detail/review | Masked validation errors | High | Schema/API later |

### Voter Flow

| Screen | Purpose | Main user | User action | Inputs | Required guidance | Next screen | Empty/error state | Difficulty | Needed changes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/voter` | Voter entry dashboard | Voter | Understand current entry route | None | Current MVP requires invite confirmation | `/voter/invite` | No invite guidance | Low | UI only |
| `/voter/invite` | Exchange invite safely | Voter | Enter/follow invite | Invite value in body only | Token not shown/stored in URL after exchange | `/voter/identify` | Generic invalid invite | Low | UI copy |
| `/voter/identify` | Verify eligible voter | Voter | Enter identifier | Current name/external identifier | Generic failure and lockout wording | `/voter/election` | No existence leakage | Medium | UI now, schema later for new fields/IP |
| `/voter/election` | Confirm election info | Voter | Review schedule/mode | None | Anonymous voting and revote policy | `/voter/ballot` | Session missing/closed | Low | UI copy |
| `/voter/ballot` | Cast ballot | Voter | Choose options | Answers | Large option rows, required validation | `/voter/review` | Missing answer | Medium | UI later for cards/dialog |
| `/voter/review` | Confirm submission | Voter | Submit final answer | None | Current MVP: revote allowed if policy permits | `/voter/complete` | Missing draft | Medium | Policy-dependent copy |
| `/voter/complete` | Confirm receipt | Voter | Read limited receipt | None | Completion only; no prior anonymous choices | `/voter/results` | Session missing | Low | UI copy |
| `/voter/results` | View published aggregate result | Voter | Read results | None | Aggregate only, small election masking | Done | Results unavailable | Low | UI copy |

## UX-2 Implementation Phases

| Phase | Scope | Notes |
| --- | --- | --- |
| UX-1 | Landing, shared navigation, admin dashboard information architecture, election list grouping, voter entry guidance | UI-only plus safe aggregate registry count |
| UX-2 | Admin dashboard/list polish, empty states, clearer status language, mobile table/card fallback | UI-only |
| UX-3 | Election creation wizard using existing create/question/registry/auth actions | Implemented as a 3-step wizard; option descriptions reuse existing schema; images deferred |
| UX-4 | Draft-only edit wizard and registry management UX | Requires careful state guards, mostly existing API |
| UX-5 | Voter dashboard and vote-select-then-auth flow design | Requires new listing/auth API and disclosure review |
| UX-6 | Auth/rate-limit policy hardening, username login decision, revote policy decision | Requires security design and tests |
| UX-7 | Schema/storage changes: shared registries, new PII fields, option photos, IP block store | Requires migration plan and staging rehearsal |

## Safe First Implementation Scope

Implemented in this first pass:

- Portal landing page with voter/admin entry, trust copy, and guarded revote wording.
- Common public navigation and admin shell links back to public entry points.
- Admin dashboard cards for total, pre-start, active, completed, and registry counts using aggregates only.
- Admin election list grouped into setup/upcoming, active, and completed sections.
- Voter entry page at `/voter` explaining the current invite-based flow.
- Empty-state copy for first-time admin election lists.

Deferred:

- Username login.
- IP lockout.
- New voter registry fields.
- Shared/preset registry management.
- Option photo upload.
- Public election listing.
- Result-auth-before-session flow.
- No-revote policy change.
- Destructive edit-mode features such as delete, reorder, replacement, and rollback.

## UX-3 Implementation Note

The `/admin/elections/new` screen now uses a three-step wizard:

1. Basic information: title, description, election type, start time, end time.
2. Question and choices: one single-choice question, at least two choice items, optional choice descriptions.
3. Voter registry: current MVP manual per-election registry entry.

The wizard uses a new server action that sequentially calls the existing service functions:

- `createElectionDraft`
- `createQuestion`
- `createOption`
- `importEligibleVoters`

The draft creation service still creates the default voter authentication policy. No Prisma schema,
migration, file upload, shared registry, username login, IP block, no-revote policy, invite flow, result
flow, Caddy, staging, or production database change was made.

## UX-4A/4B Implementation Note

UX-4A remodeled the admin election detail screen and added Draft-only edit entry points that reuse the existing question, voter registry, and authentication setting pages. It did not add a unified edit wizard action or destructive edit behavior.

UX-4B defines the safe edit policy before implementation. See `docs/draft-edit-wizard-rfc.md` for:

- current update capability analysis,
- state-based edit policy,
- question/option edit policy,
- voter registry append/replacement policy,
- integrated edit wizard UX design,
- proposed `updateElectionWizardAction` constraints.

## UX-4C/4D/4E/4F/4G Implementation Note

The `/admin/elections/[election_id]/edit` route now supports a Draft-only, pre-start edit wizard:

1. Basic information: title, description, election type, start time, end time.
2. Question and choices: question title/description, existing option label/description, append-only new options.
3. Voter registry/auth: MVP authentication method update and safe voter registry summary.

UX-4F added completion polish and a Draft detail pre-review summary. The detail page now shows
"ready" versus "needs attention" checks for basic information, schedule, questions, option count,
voter registry, and authentication policy before the admin sends a review request.

UX-4G is the final review and PR preparation pass. It keeps Phase 1 in the implemented UX scope,
aligns user-facing wording, checks route/CTA wiring, confirms no sensitive internal labels are exposed,
and avoids adding new domain features.

Still deferred:

- voter registry replacement and shared/preset registries,
- option/question delete or reorder,
- option photos,
- ReadyForReview rollback or direct post-review edit policy,
- username login, IP blocking, and no-revote policy changes.
- public election listing and vote-select-then-auth flow.
