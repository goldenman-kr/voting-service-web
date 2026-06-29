# 온라인 투표 서비스 ERD 상세 설계

## 1. ERD 설계 원칙

- SaaS 경계는 `tenants`와 `organizations`로 분리한다.
- 관리자 권한은 RBAC로 관리하며 `roles`와 `permissions`를 분리한다.
- 하나의 `elections`는 여러 `questions`를 가질 수 있고, 각 `questions`는 여러 `options`를 가진다.
- 유권자 명부는 Election별 `voter_registries`로 독립 확정한다.
- 투표자 인증은 `authentication_policies`로 분리하며, MVP 기본값은 `invite_link_with_identifier`이다.
- `voting_credentials`는 1회성 인증코드가 아니라 투표 참여 자격, 인증 상태, 투표권 사용 상태를 관리한다.
- 익명투표에서 `eligible_voters`, `voting_credentials`, `anonymous_voting_passes`와 `ballots`, `votes` 사이에 직접 FK를 두지 않는다.
- `anonymous_ballot_groups.ballot_group_token_hash`는 유권자 식별자 기반 해시가 아니라 랜덤 토큰 기반 해시이다.
- 재투표는 기존 Ballot 수정이 아니라 새 `ballots` 생성으로 기록하고, 마지막 accepted Ballot만 current로 표시한다.
- `results`와 `result_versions`를 분리해 Published 이후 결과 덮어쓰기를 금지한다.
- `audit_events`, `security_events`, `credential_events`, `submission_events`, `db_access_events`는 목적과 재식별 위험에 따라 분리한다.
- 개인정보는 원문 암호화, 검색용 HMAC, 화면 마스킹, 보관/파기 상태를 함께 설계한다.

## 2. 전체 테이블 목록

| 영역 | 테이블 |
| --- | --- |
| SaaS / 조직 / 사용자 | `tenants`, `organizations`, `users`, `user_mfa_methods` |
| RBAC | `roles`, `permissions`, `role_permissions`, `user_roles` |
| Election / Policy / State | `elections`, `election_policies`, `election_state_histories`, `election_change_histories`, `questions`, `options` |
| AuthenticationPolicy / Invitation / VotingCredential | `authentication_policies`, `organization_authentication_methods`, `invitations`, `voting_credentials`, `credential_events` |
| VoterRegistry / EligibleVoter | `voter_registries`, `voter_registry_imports`, `voter_registry_validation_errors`, `eligible_voters` |
| Anonymous Voting | `anonymous_voting_passes`, `anonymous_ballot_groups` |
| Ballot / Vote | `ballots`, `votes`, `vote_options`, `submission_events` |
| Result / Report | `results`, `result_items`, `result_versions`, `reports`, `report_exports` |
| Dispute / Correction / Invalidation / Incident | `disputes`, `correction_requests`, `invalidation_records`, `operation_incidents` |
| Audit / Security / Access Log | `audit_events`, `security_events`, `db_access_events` |
| Data Retention / Deletion | `retention_policies`, `data_deletion_requests`, `data_deletion_jobs` |
| Notification / Delivery | `notification_templates`, `notification_deliveries` |

## 3. 공통 컬럼 및 타입 기준

- PK: `id uuid primary key`
- FK: `{target}_id uuid not null`
- 시간: `timestamptz`
- 상태/타입: enum 또는 제한된 text. DB enum보다 text + check constraint도 가능하다.
- JSON: `jsonb`, 단 검색/권한 판단이 필요한 값은 정규 컬럼으로 둔다.
- 암호화 필드: `{field}_encrypted text`
- 검색용 HMAC: `{field}_hmac text`
- 마스킹 표시용 값: `{field}_masked text`
- 삭제/파기: 업무 삭제가 필요한 테이블은 `deleted_at`, 개인정보 파기가 필요한 테이블은 `pii_purged_at`, `retention_expires_at`를 둔다.

## 4. 테이블별 상세 설계

### 4.1 SaaS / 조직 / 사용자

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tenants` | SaaS 고객 경계 | `id uuid required`, `name text required`, `status text required`, `plan_code text`, `created_at timestamptz`, `updated_at timestamptz` | 없음 | UQ `name`; IDX `status` | 민감정보 없음 | `active`, `suspended`, `closed` | 폐쇄 후 조직 정책에 따라 보관 |
| `organizations` | 투표 운영 단체 | `id`, `tenant_id required`, `name text required`, `status text required`, `default_timezone text required`, `settings jsonb`, `created_at`, `updated_at` | `tenant_id -> tenants.id` | UQ `(tenant_id, name)`; IDX `(tenant_id, status)` | 설정에 비밀값 저장 금지 | `active`, `suspended`, `archived` | Tenant 폐쇄 정책 따름 |
| `users` | 관리자/감사자 계정 | `id`, `tenant_id required`, `organization_id nullable`, `email_encrypted required`, `email_hmac required`, `name_encrypted required`, `name_masked`, `status required`, `last_login_at`, `created_at`, `updated_at` | `tenant_id`, `organization_id` | UQ `(tenant_id, email_hmac)`; IDX `(organization_id, status)` | 이메일/이름 암호화, email HMAC 검색, 마스킹 | `active`, `invited`, `locked`, `disabled` | 계정 비활성 후 감사 로그는 보존 |
| `user_mfa_methods` | 관리자 MFA 수단 | `id`, `user_id required`, `method_type required`, `secret_encrypted`, `public_key text`, `status required`, `registered_at`, `last_used_at` | `user_id -> users.id` | UQ `(user_id, method_type, public_key)`; IDX `(user_id, status)` | MFA secret 암호화 | `totp`, `webauthn`, `backup_code`; `active`, `revoked` | 폐기 후 secret 파기 |

### 4.2 RBAC

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `roles` | 권한 묶음 | `id`, `organization_id nullable`, `code required`, `name required`, `scope required`, `is_system_role boolean`, `status`, `created_at` | `organization_id -> organizations.id` | UQ `(organization_id, code)`; IDX `scope` | 없음 | `system`, `organization`, `election`; `active`, `disabled` | 사용 중 role 삭제 금지, 비활성 처리 |
| `permissions` | 행위 권한 | `id`, `code required`, `description`, `risk_level required`, `created_at` | 없음 | UQ `code`; IDX `risk_level` | 없음 | `low`, `medium`, `high`, `critical` | 시스템 기준값, 삭제 지양 |
| `role_permissions` | Role-Permission 매핑 | `role_id required`, `permission_id required`, `granted_at`, `granted_by` | `role_id`, `permission_id`, `granted_by -> users.id` | PK `(role_id, permission_id)` | 권한 변경 AuditEvent 필수 | 없음 | 삭제 대신 변경 이력 감사 |
| `user_roles` | User-Role 매핑 | `user_id required`, `role_id required`, `organization_id required`, `election_id nullable`, `assigned_at`, `assigned_by`, `revoked_at` | `user_id`, `role_id`, `organization_id`, `election_id -> elections.id` | UQ active `(user_id, role_id, organization_id, election_id)`; IDX `(organization_id, user_id)` | 없음 | active 여부는 `revoked_at` | 회수 시 `revoked_at` 기록 |

### 4.3 Election / Policy / State

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `elections` | 투표 이벤트 | `id`, `organization_id required`, `title required`, `description text`, `election_type required`, `state required`, `notice_starts_at`, `starts_at required`, `ends_at required`, `created_by required`, `created_at`, `updated_at`, `archived_at` | `organization_id`, `created_by -> users.id` | IDX `(organization_id, state)`, `(starts_at, ends_at)` | 설명에 PII 입력 주의 | `draft`, `ready_for_review`, `approved`, `scheduled`, `notice`, `open`, `paused`, `closed`, `tallying`, `pending_confirmation`, `confirmed`, `published`, `archived`, `invalidated` | Draft만 삭제 가능, 이후 보관 |
| `election_policies` | 투표 정책 | `id`, `election_id required`, `voting_mode required`, `revote_allowed boolean default true`, `result_visibility required`, `result_detail_level required`, `quorum_policy jsonb`, `small_group_rule jsonb`, `created_at`, `updated_at` | `election_id -> elections.id` | UQ `election_id` | 정책 변경 이력 저장 | `anonymous`, `named`; visibility `participants`, `eligible_voters`, `public`, `private` | Election과 함께 보관 |
| `election_state_histories` | 상태 전환 이력 | `id`, `election_id required`, `from_state`, `to_state required`, `requested_by`, `approved_by`, `reason required for risk`, `changed_at`, `change_type required` | `election_id`, `requested_by -> users.id`, `approved_by -> users.id` | IDX `(election_id, changed_at)`, `(to_state)` | reason에 PII 금지 | `manual`, `scheduled`, `system` | append-only |
| `election_change_histories` | 설정 변경 이력 | `id`, `election_id required`, `changed_area required`, `before_summary jsonb`, `after_summary jsonb`, `changed_by required`, `changed_at` | `election_id`, `changed_by -> users.id` | IDX `(election_id, changed_at)` | summary에 명부 원문/토큰 금지 | area: `basic`, `schedule`, `policy`, `question`, `registry` | append-only |
| `questions` | 문항 | `id`, `election_id required`, `title required`, `description`, `question_type required`, `required boolean`, `min_select int`, `max_select int`, `display_order int`, `status` | `election_id` | UQ `(election_id, display_order)`; IDX `election_id` | 자유 설명 PII 주의 | `single_choice`, `multiple_choice`, `yes_no`, `free_text`; `active`, `disabled` | Open 이후 수정 금지, 이력 보존 |
| `options` | 선택지 | `id`, `question_id required`, `label required`, `description`, `display_order int`, `status` | `question_id -> questions.id` | UQ `(question_id, display_order)`; IDX `question_id` | 후보자 개인정보 포함 가능, 표시 정책 필요 | `active`, `disabled` | Open 이후 수정 금지 |

### 4.4 AuthenticationPolicy / Invitation / VotingCredential

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `authentication_policies` | 투표별 인증 방식 | `id`, `election_id required`, `method required default 'invite_link_with_identifier'`, `is_enabled boolean`, `is_paid_method boolean`, `provider text`, `security_level required`, `identifier_fields jsonb`, `code_channel text nullable`, `code_ttl_minutes int nullable`, `max_code_resends int nullable`, `created_at`, `updated_at` | `election_id -> elections.id` | UQ `election_id`; IDX `method` | provider credential 저장 금지 | method: `invite_link_only`, `invite_link_with_identifier`, `email_code`, `sms_code`, `kakao_message`, `external_identity`, `sso`, `legal_strong_auth`; level `low`, `standard`, `high`, `legal` | Election과 함께 보관 |
| `organization_authentication_methods` | 조직별 허용 인증 방식 | `id`, `organization_id required`, `method required`, `is_allowed boolean`, `is_paid_method boolean`, `provider text`, `enabled_at`, `disabled_at` | `organization_id` | UQ `(organization_id, method, provider)` | 비용/제공자 설정에 secret 저장 금지 | method 동일 | 조직 설정 보관 |
| `invitations` | 초대 링크/발송 상태 | `id`, `election_id required`, `eligible_voter_id required`, `invite_token_hash required`, `channel required`, `status required`, `sent_at`, `last_sent_at`, `send_count int default 0`, `expires_at required`, `created_at` | `election_id`, `eligible_voter_id` | UQ `invite_token_hash`; IDX `(election_id, status)`, `(eligible_voter_id)` | 초대 토큰 원문 저장 금지 | `pending`, `sent`, `failed`, `opened`, `expired`, `revoked` | 투표 종료 시 만료, 토큰 해시 제한 보관 |
| `voting_credentials` | 투표 참여 자격/인증/투표권 상태 | `id`, `election_id required`, `eligible_voter_id required`, `credential_status required`, `auth_status required`, `identifier_failed_attempts int default 0`, `locked_until`, `authenticated_at`, `has_voted boolean default false`, `last_vote_confirmed_at`, `submission_count int default 0`, `created_at`, `updated_at` | `election_id`, `eligible_voter_id` | UQ `(election_id, eligible_voter_id)`; IDX `(election_id, auth_status)`, `(locked_until)` | Ballot/Vote FK 금지. 선택 내용 저장 금지 | credential `active`, `locked`, `revoked`; auth `not_started`, `identifier_verified`, `code_pending`, `authenticated`, `failed` | 개인정보 파기 시 식별 연결 파기 가능 |
| `credential_events` | 인증 영역 이벤트 | `id`, `election_id required`, `voting_credential_id required`, `event_type required`, `method required`, `channel nullable`, `provider nullable`, `success boolean`, `failure_reason_code`, `occurred_at`, `metadata jsonb` | `election_id`, `voting_credential_id` | IDX `(voting_credential_id, occurred_at)`, `(election_id, event_type)` | Ballot ID, AnonymousBallotGroup ID 저장 금지. 코드 원문 금지 | `invite_opened`, `identifier_check_success`, `identifier_check_failed`, `code_sent`, `code_resent`, `code_verified`, `code_failed`, `external_auth_success`, `external_auth_failed`, `locked`, `unlocked` | 인증 상세 로그는 단기 보관 가능 |

인증코드 방식이 활성화된 Election에서만 `code_sent`, `code_resent`, `code_verified`, `code_failed` 이벤트가 생성된다. 인증코드 해시는 `credential_events.metadata`가 아니라 별도 보안 저장소 또는 제한 컬럼에 두되, 원문은 저장하지 않는다.

### 4.5 VoterRegistry / EligibleVoter

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `voter_registries` | Election별 명부 | `id`, `election_id required`, `status required`, `voter_count int`, `confirmed_at`, `confirmed_by`, `retention_expires_at`, `pii_purged_at` | `election_id`, `confirmed_by -> users.id` | UQ `election_id`; IDX `status` | 명부 조회 권한 제한 | `draft`, `validating`, `confirmed`, `locked`, `purged` | 종료 후 보관 기간 경과 시 PII 파기 |
| `voter_registry_imports` | 명부 업로드 | `id`, `registry_id required`, `uploaded_by required`, `file_name text`, `file_hash text`, `status required`, `total_rows int`, `valid_rows int`, `error_count int`, `uploaded_at` | `registry_id`, `uploaded_by -> users.id` | IDX `(registry_id, uploaded_at)`, `file_hash` | 원본 파일 보관 최소화/암호화 | `uploaded`, `validated`, `failed`, `discarded` | 원본 파일 단기 보관 후 삭제 |
| `voter_registry_validation_errors` | 명부 검증 오류 | `id`, `import_id required`, `row_number int`, `field_name text`, `error_type required`, `message text`, `created_at` | `import_id` | IDX `(import_id, error_type)` | 오류 메시지에 PII 원문 금지 | `missing_required`, `duplicate`, `invalid_format`, `conflict` | import 보관 정책 따름 |
| `eligible_voters` | 유권자 | `id`, `registry_id required`, `external_id_encrypted`, `external_id_hmac required`, `external_id_masked`, `name_encrypted required`, `name_hmac`, `name_masked`, `email_encrypted`, `email_hmac`, `email_masked`, `phone_encrypted`, `phone_hmac`, `phone_masked`, `status required`, `created_at`, `pii_purged_at` | `registry_id` | UQ `(registry_id, external_id_hmac)`; IDX `(registry_id, status)`, `(email_hmac)`, `(phone_hmac)` | 이름/외부식별자/이메일/전화번호 암호화, HMAC, 마스킹 | `eligible`, `excluded`, `withdrawn`, `purged` | PII 파기 후 투표 결과와 분리 보관 |

MVP 유권자 식별자 기본값은 이름 + 조직 내 외부 식별자이다. 외부 식별자는 회원번호, 사번, 학번, 조합원번호 등을 의미한다.

### 4.6 Anonymous Voting

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `anonymous_voting_passes` | 익명 투표권 발급/사용 상태 | `id`, `election_id required`, `voting_credential_id required`, `pass_status required`, `issued_at`, `used_at`, `revoked_at`, `usage_count int default 0` | `election_id`, `voting_credential_id` | UQ `(election_id, voting_credential_id)`; IDX `(election_id, pass_status)` | BallotGroup/Ballot/Vote FK 금지. 선택 내용 저장 금지 | `issued`, `used`, `revoked`, `expired` | 인증 영역 보관 정책 |
| `anonymous_ballot_groups` | 익명 재투표 그룹 | `id`, `election_id required`, `ballot_group_token_hash required`, `current_ballot_id nullable`, `submission_count int default 0`, `last_submitted_at`, `created_at` | `election_id`; `current_ballot_id -> ballots.id`는 nullable이며 유권자 영역 FK 아님 | UQ `(election_id, ballot_group_token_hash)`; IDX `(election_id, current_ballot_id)` | token 원문 저장 금지. `eligible_voter_id`, `voting_credential_id` 금지 | 없음 | 결과 검증 기간 보관, PII 없음 |

`anonymous_ballot_groups`에는 `eligible_voter_id`, `voting_credential_id`, `anonymous_voting_pass_id`, `user_id`를 두지 않는다. `ballot_group_token_hash`는 랜덤 토큰에서 생성하며 유권자 식별자, credential id, external id hash에서 재계산 가능하면 안 된다.

### 4.7 Ballot / Vote

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ballots` | 제출 이력 | `id`, `election_id required`, `anonymous_ballot_group_id required for anonymous`, `submission_status required`, `acceptance_status required`, `server_received_at required`, `is_current boolean default false`, `superseded_at`, `receipt_hash required`, `created_at` | `election_id`, `anonymous_ballot_group_id` | IDX `(election_id, is_current, acceptance_status)`, `(anonymous_ballot_group_id, server_received_at)`; partial UQ current `(anonymous_ballot_group_id) where is_current=true` | `eligible_voter_id`, `voting_credential_id`, `user_id` 금지 | submission `received`, `failed`, `uncertain`; acceptance `accepted`, `rejected_late`, `rejected_invalid`, `superseded` | Ballot 이력 보존 |
| `votes` | 문항별 응답 | `id`, `ballot_id required`, `question_id required`, `answer_type required`, `free_text_encrypted nullable`, `created_at` | `ballot_id`, `question_id` | UQ `(ballot_id, question_id)`; IDX `question_id` | 유권자/credential/user FK 금지. 자유 의견 암호화 | `option`, `free_text`, `abstain` | Ballot 보관 정책 |
| `vote_options` | 선택형 응답 매핑 | `vote_id required`, `option_id required` | `vote_id`, `option_id` | PK `(vote_id, option_id)`; IDX `option_id` | PII 없음 | 없음 | Vote와 함께 보관 |
| `submission_events` | 제출 영역 이벤트 | `id`, `election_id required`, `ballot_id nullable`, `event_type required`, `server_received_at`, `acceptance_status`, `reason_code`, `ip_masked`, `user_agent_summary`, `created_at` | `election_id`, `ballot_id` | IDX `(election_id, created_at)`, `(ballot_id)` | `eligible_voter_id`, `voting_credential_id` 금지. IP/UA 원문 지양 | `submission_started`, `submission_accepted`, `submission_failed`, `submission_uncertain`, `late_rejected`, `superseded` | 제출 상세 로그는 제한 보관 |

공식 집계 대상 Ballot 조건은 `is_current = true`, `acceptance_status = accepted`, `server_received_at <= elections.ends_at`이다.

### 4.8 Result / Report

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `results` | 집계 실행 결과 | `id`, `election_id required`, `status required`, `tallied_at`, `tallied_by`, `source_rule required`, `created_at` | `election_id`, `tallied_by -> users.id` | IDX `(election_id, status)` | 확정 전 접근 제한 | `draft`, `tallied`, `discarded` | ResultVersion 참조 시 보존 |
| `result_items` | 문항/선택지별 집계 | `id`, `result_id required`, `question_id required`, `option_id nullable`, `count int required`, `rate numeric(7,4)`, `metadata jsonb` | `result_id`, `question_id`, `option_id` | IDX `(result_id, question_id)`, `(option_id)` | 소규모 익명투표 공개 제한 적용 | 없음 | Result와 함께 보관 |
| `result_versions` | 공식 결과 버전 | `id`, `election_id required`, `result_id required`, `version_no int required`, `version_type required`, `status required`, `confirmed_by`, `published_at`, `notice text`, `created_at` | `election_id`, `result_id`, `confirmed_by -> users.id` | UQ `(election_id, version_no)`; IDX `(election_id, status)` | 공개 전 접근 제한 | `initial`, `correction`, `withdrawal`, `invalidation_notice`; `confirmed`, `published`, `superseded` | Published 이후 덮어쓰기 금지 |
| `reports` | 보고서 정의 | `id`, `election_id required`, `result_version_id required`, `report_type required`, `status required`, `created_by`, `created_at` | `election_id`, `result_version_id`, `created_by` | IDX `(election_id, report_type)` | 파일 접근 제한 | `result_summary`, `question_detail`, `turnout`, `audit_summary`, `admin_history`, `dispute`, `invalidation` | 보고서 정책 보관 |
| `report_exports` | 보고서 출력 이력 | `id`, `report_id required`, `export_format required`, `exported_by required`, `purpose required`, `watermark_id`, `exported_at` | `report_id`, `exported_by -> users.id` | IDX `(report_id, exported_at)`, `(exported_by)` | 출력 파일 마스킹/워터마크 | `pdf`, `csv`, `xlsx` | 장기 감사 대상 |

### 4.9 Dispute / Correction / Invalidation / Incident

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- |
| `disputes` | 결과/절차 이의제기 | `id`, `election_id required`, `submitted_by_type required`, `submitted_by_user_id nullable`, `status required`, `reason_encrypted required`, `submitted_at`, `resolved_at`, `resolved_by` | `election_id`, `submitted_by_user_id`, `resolved_by -> users.id` | IDX `(election_id, status)`, `(submitted_at)` | 사유 암호화, 접근 제한 | `submitted`, `reviewing`, `accepted`, `rejected`, `closed` | 결과와 함께 보관 |
| `correction_requests` | Published 이후 정정 요청 | `id`, `election_id required`, `result_version_id required`, `status required`, `reason required`, `requested_by required`, `approved_by`, `created_at`, `approved_at` | `election_id`, `result_version_id`, `requested_by`, `approved_by` | IDX `(election_id, status)` | 사유에 PII 금지 | `requested`, `approved`, `rejected`, `applied` | append-only |
| `invalidation_records` | 무효 처리 | `id`, `election_id required`, `result_version_id nullable`, `reason required`, `evidence_summary`, `requested_by required`, `approved_by required`, `invalidated_at`, `notice text` | `election_id`, `result_version_id`, `requested_by`, `approved_by` | UQ `(election_id)` where active; IDX `invalidated_at` | 근거 자료 접근 제한 | 없음 | 장기 보존 |
| `operation_incidents` | 장애/운영 사고 | `id`, `election_id required`, `incident_type required`, `severity required`, `status required`, `started_at`, `ended_at`, `impact_summary`, `resolution`, `created_by` | `election_id`, `created_by -> users.id` | IDX `(election_id, status)`, `(severity)` | 장애 메모에 PII 금지 | `auth_issue`, `submission_issue`, `infra`, `admin_error`, `security`; `open`, `mitigated`, `resolved` | 장애 감사 보관 |

### 4.10 Audit / Security / Access Log

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `audit_events` | 업무 감사 | `id`, `tenant_id required`, `organization_id`, `actor_user_id`, `event_type required`, `target_type required`, `target_id uuid`, `risk_level`, `reason`, `before_summary jsonb`, `after_summary jsonb`, `occurred_at`, `integrity_hash` | `tenant_id`, `organization_id`, `actor_user_id` | IDX `(organization_id, occurred_at)`, `(event_type)`, `(target_type, target_id)` | 토큰/코드/민감 PII/선택 내용 원문 금지 | risk `low`, `medium`, `high`, `critical` | append-only, 기본 5년 또는 조직 정책 |
| `security_events` | 보안 이벤트 | `id`, `tenant_id`, `actor_type required`, `actor_id uuid nullable`, `event_type required`, `risk_level required`, `ip_masked`, `user_agent_summary`, `occurred_at`, `metadata jsonb` | `tenant_id` | IDX `(tenant_id, occurred_at)`, `(event_type, risk_level)` | IP/UA 원문 지양, 토큰 금지 | `login_success`, `login_failed`, `mfa_success`, `mfa_failed`, `suspicious_access`, `account_locked` | 상세 1년, 위험 요약 3년 기본 |
| `db_access_events` | DB 긴급 접근 감사 | `id`, `actor_user_id required`, `approval_id`, `access_type required`, `target_area required`, `reason required`, `started_at`, `ended_at`, `row_count_summary int`, `post_review_status` | `actor_user_id -> users.id` | IDX `(actor_user_id, started_at)`, `(target_area)` | query/result 원문 금지 | `read`, `export`, `maintenance`, `restore`; review `pending`, `approved`, `flagged` | 장기 감사 대상 |

익명투표에서 `credential_events`와 `submission_events`는 개인 단위로 조인 가능한 키를 공유하지 않는다. 두 로그를 연결해 특정 유권자의 Ballot 또는 Vote를 추정하는 조회/보고 기능도 금지한다.

### 4.11 Data Retention / Deletion

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `retention_policies` | 조직별 보관 정책 | `id`, `organization_id required`, `data_category required`, `retention_days nullable`, `is_default boolean`, `created_at`, `updated_at` | `organization_id` | UQ `(organization_id, data_category)` | 없음 | `voter_pii`, `credential_detail`, `audit_log`, `security_log`, `report`, `backup` | 정책 변경 감사 |
| `data_deletion_requests` | 파기 요청 | `id`, `organization_id required`, `election_id nullable`, `requested_by required`, `approved_by`, `data_category required`, `status required`, `reason`, `requested_at`, `approved_at` | `organization_id`, `election_id`, `requested_by`, `approved_by` | IDX `(organization_id, status)`, `(election_id)` | 사유 PII 금지 | `requested`, `approved`, `rejected`, `completed`, `failed` | 요청/승인 이력 보존 |
| `data_deletion_jobs` | 파기 작업 실행 | `id`, `deletion_request_id required`, `job_status required`, `target_table required`, `started_at`, `finished_at`, `deleted_count int`, `backup_reflection_status required`, `error_summary` | `deletion_request_id` | IDX `(job_status)`, `(target_table)` | 오류에 PII 금지 | `pending`, `running`, `completed`, `failed`; backup `not_applicable`, `pending_retention_expiry`, `reflected_after_restore` | 작업 이력 보존 |

백업 데이터 파기 반영은 별도 운영 정책이 필요하다. 운영 DB에서 파기된 개인정보가 백업에 남을 수 있으므로 `backup_reflection_status`를 통해 백업 보관기간 만료 또는 복구 후 재파기 필요 여부를 추적한다.

### 4.12 Notification / Delivery

| 테이블명 | 목적 | 주요 컬럼 | FK | Unique / Index | 보안/암호화/마스킹 | 상태/enum | 삭제/보관 |
| --- | --- | --- | --- | --- | --- | --- |
| `notification_templates` | 알림 템플릿 | `id`, `organization_id nullable`, `template_type required`, `channel required`, `subject`, `body_template`, `status`, `created_at` | `organization_id` | UQ `(organization_id, template_type, channel)` | 템플릿에 토큰 원문 저장 금지 | channel `app`, `email`, `sms`, `kakao`; status `active`, `disabled` | 변경 이력 감사 |
| `notification_deliveries` | 알림 발송 이력 | `id`, `organization_id required`, `election_id nullable`, `recipient_type required`, `recipient_ref_id uuid nullable`, `channel required`, `delivery_type required`, `status required`, `provider`, `sent_at`, `failed_at`, `failure_reason_code` | `organization_id`, `election_id` | IDX `(election_id, delivery_type)`, `(status, sent_at)` | 수신자 PII 원문 금지, provider payload 저장 금지 | `pending`, `sent`, `failed`, `suppressed` | 발송 이력 제한 보관 |

SMS, 카카오, 외부 본인확인 등 비용 발생 채널은 기본 비활성이다. 조직별 허용 여부는 `organization_authentication_methods`와 알림 설정에서 통제한다.

## 5. 익명투표 관련 금지 FK 및 로그 제약

| 대상 | 금지 컬럼 / 금지 관계 |
| --- | --- |
| `ballots` | `eligible_voter_id`, `voting_credential_id`, `anonymous_voting_pass_id`, `user_id` 금지 |
| `votes` | `eligible_voter_id`, `voting_credential_id`, `anonymous_voting_pass_id`, `user_id` 금지 |
| `anonymous_ballot_groups` | `eligible_voter_id`, `voting_credential_id`, `anonymous_voting_pass_id`, `user_id` 금지 |
| `submission_events` | `eligible_voter_id`, `voting_credential_id`, `anonymous_voting_pass_id` 금지 |
| `credential_events` | `ballot_id`, `anonymous_ballot_group_id`, `vote_id` 금지 |
| 인증 영역 로그와 제출 영역 로그 | 개인 단위로 조인 가능한 공통 키 공유 금지 |

## 6. 선택형 인증 정책 상세

| 인증 방식 | 기본 활성 | 비용 발생 | 보안 수준 | 투표별 사용 | 조직별 허용 | 확장 |
| --- | --- | --- | --- | --- | --- | --- |
| `invite_link_only` | 비활성 | 없음 | 낮음 | 제한 옵션 | 허용 가능 | 가능 |
| `invite_link_with_identifier` | 활성 | 없음 | 표준 | 기본값 | 기본 허용 | 가능 |
| `email_code` | 비활성 | 낮음/중간 | 표준+ | 선택 | 조직별 허용 | 가능 |
| `sms_code` | 비활성 | 있음 | 표준+ | 선택 | 조직별 허용 | 가능 |
| `kakao_message` | 비활성 | 있음 | 표준+ | 선택 | 조직별 허용 | 가능 |
| `external_identity` | 비활성 | 있음 | 높음 | 선택 | 조직별 허용 | 가능 |
| `sso` | 비활성 | 연동 비용 가능 | 높음 | 선택 | 조직별 허용 | 가능 |
| `legal_strong_auth` | 비활성 | 있음 | 법적 효력 모드 | MVP 제외 | 별도 모드 | 향후 |

인증코드 재발송, 인증코드 만료, 인증코드 실패 잠금은 `email_code`, `sms_code`, `kakao_message` 등 코드 기반 방식이 활성화된 Election에만 적용한다. 유권자 식별 실패 제한, 초대 링크 만료, 비정상 접근 로그, 투표 완료 여부 관리, 중복 투표 방지, 익명투표 데이터 분리는 인증 방식과 무관하게 항상 적용한다.

## 7. ERD 무결성 검토

| 검토 항목 | 결과 |
| --- | --- |
| 초기 요구사항 충족 | 관리자, 투표 생성/시작/종료/결과/출력, 수정 제한, 명부 암호화, 로그 저장 요구를 반영했다. |
| Phase 3.5 익명성 요구 | 유권자/인증 영역과 Ballot/Vote 영역의 직접 FK를 금지했다. |
| 인증코드 선택형 정책 | `authentication_policies`와 넓은 의미의 `voting_credentials`로 반영했다. |
| 재투표 구조 | `anonymous_ballot_groups`와 `ballots.is_current`로 마지막 accepted Ballot만 집계 가능하다. |
| 결과 버전 관리 | `results`와 `result_versions`를 분리해 Published 이후 덮어쓰기를 방지한다. |
| 감사 로그 구조 | `audit_events`, `security_events`, `credential_events`, `submission_events`, `db_access_events`를 분리했다. |
| 개인정보 보호 | 암호화, HMAC, 마스킹, 보관 만료, 파기 상태를 표현한다. |
| 위험한 FK 또는 조인 | 설계상 익명투표의 직접 FK는 금지했다. 단, 운영자가 시간/IP/User-Agent로 상관분석하지 못하도록 API/화면 권한도 이어서 제한해야 한다. |
| API 전 보완 항목 | identifier field 정책, 코드 기반 인증의 실제 해시 저장 위치, 로그 무결성 구현 방식, 소규모 익명투표 공개 제한 수치 확정이 필요하다. |
