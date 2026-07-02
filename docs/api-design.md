# 온라인 투표 서비스 API 설계서

## 1. API 설계 원칙

본 문서는 `docs/online-voting-service-design.md`, `docs/requirements-enhancement-proposal.md`, `docs/erd-design.md`, `docs/ui-design-and-screen-spec.md`를 기준으로 관리자 포털과 투표자 포털에서 사용할 API 구조를 정의한다. 구현 코드, 화면 구현, ERD 변경은 포함하지 않는다.

| 원칙 | 설계 기준 |
| --- | --- |
| API 스타일 | MVP는 JSON 기반 REST API를 기본으로 한다. Path는 `/api/v1` 아래에 `admin`, `voter`, `public` 영역을 분리한다. |
| Tenant / Organization 범위 제어 | 관리자 API는 세션의 tenant/organization scope와 path의 organization id를 교차 검증한다. 다른 조직 데이터 접근은 403 또는 404-equivalent 응답으로 차단한다. |
| RBAC 기반 권한 검증 | 모든 관리자 API는 Permission을 기준으로 검증한다. Role은 Permission 묶음이며 API는 Role 이름에 직접 의존하지 않는다. |
| 관리자 API와 투표자 API 분리 | 관리자 업무 API는 `/admin`, 투표자 투표 흐름은 `/voter`, 공개 결과는 `/public`로 분리한다. |
| 익명투표 API 영역 분리 | 인증/자격 영역 API와 Ballot/Vote 제출 API는 직접 조인 가능한 식별자를 request/response에 공유하지 않는다. |
| 권한별 응답 필드 제한 | 같은 리소스라도 Role/Permission에 따라 응답 필드를 제한한다. 일반 관리자는 익명투표의 개인별 제출 상세를 볼 수 없다. |
| 이벤트 기록 지점 명확화 | 위험 작업은 AuditEvent, 로그인/MFA는 SecurityEvent, 인증 흐름은 CredentialEvent, 제출 흐름은 SubmissionEvent, DB 접근은 DbAccessEvent를 남긴다. |
| 민감정보 원문 응답 금지 | 토큰 원문, 인증코드 원문, 세션 토큰, 민감 개인정보 원문, ballot group token 원문은 API 응답에 포함하지 않는다. |
| Published 이후 덮어쓰기 금지 | 공개 결과 수정/삭제 API를 만들지 않는다. 정정은 CorrectionRequest와 새 ResultVersion으로만 처리한다. |
| 유권자 존재 여부 노출 금지 | 투표자 인증 실패 응답은 존재 여부, 어떤 필드가 틀렸는지, 명부 포함 여부를 구분해 알려주지 않는다. |

### 1.1 공통 API 규칙

| 항목 | 규칙 |
| --- | --- |
| Versioning | `/api/v1`을 사용한다. breaking change는 `/api/v2` 또는 명시적 version negotiation으로 처리한다. |
| Content-Type | 요청/응답은 기본 `application/json`이다. 파일 업로드/다운로드는 multipart 또는 binary stream을 사용하되 API 명세에서 별도 표시한다. |
| Time | 모든 공식 시각은 서버 기준 `ISO-8601 timestamptz`로 반환한다. 마감 판정은 서버 접수 완료 시각이다. |
| Pagination | 목록 API는 `page`, `page_size`, `sort`, `filter`를 사용한다. 응답에는 `items`, `page`, `page_size`, `total_count`를 포함한다. |
| Idempotency | 투표 제출, 보고서 생성, 초대 발송, 위험 작업 요청은 `Idempotency-Key` 헤더 사용을 권장한다. |
| Request ID | 모든 응답은 `request_id`를 포함한다. 로그 상관분석에 사용하되 익명투표 개인 단위 연결 키로 사용하면 안 된다. |
| Step-up | 위험 작업은 짧은 TTL의 step-up 권한 상태를 요구한다. 문서의 `step_up_token` 표현은 실제 토큰 원문이 아니라 one-time opaque handle 또는 서버 세션에 묶인 권한 상태를 의미한다. |
| 토큰/세션 전달 | 관리자 세션, step-up 권한 상태, voter session, invite exchange handle은 원칙적으로 HttpOnly, Secure, SameSite cookie를 우선한다. JSON body로 반환해야 하는 경우 one-time opaque handle로 제한하고 짧은 만료 시간을 둔다. |
| 로그 redaction | invite token, session token, step-up handle, voter session handle은 application log, access log, error log, APM log에 기록하지 않는다. URL path/query에 민감 토큰이나 목적 입력을 두지 않는다. |

### 1.2 공통 응답 형식

성공 응답은 다음 구조를 기본으로 한다.

```json
{
  "request_id": "req_...",
  "data": {},
  "meta": {}
}
```

오류 응답은 다음 구조를 기본으로 한다.

```json
{
  "request_id": "req_...",
  "error": {
    "code": "ELECTION_CLOSED",
    "message": "투표가 마감되었습니다.",
    "user_message": "투표가 마감되었습니다.",
    "admin_message": "서버 접수 시각이 종료 시각 이후입니다.",
    "retryable": false
  }
}
```

투표자 API의 `message`와 `user_message`는 유권자 존재 여부, 명부 포함 여부, 인증 정보 중 어떤 값이 틀렸는지 노출하지 않는다.

## 2. API 영역 구분

| 영역 | Prefix | 목적 |
| --- | --- | --- |
| Auth / Session API | `/api/v1/admin/auth` | 관리자 로그인, MFA, step-up, 세션 관리 |
| Organization / User / Role / Permission API | `/api/v1/admin/organizations` | 조직 설정, 관리자, RBAC 관리 |
| Election API | `/api/v1/admin/elections` | 투표 생성, 수정, 조회, 상태 관리 |
| AuthenticationPolicy API | `/api/v1/admin/elections/{election_id}/authentication-policy` | 투표별 인증 정책 설정 |
| Question / Option API | `/api/v1/admin/elections/{election_id}/questions` | 문항/선택지 관리 |
| VoterRegistry / EligibleVoter API | `/api/v1/admin/elections/{election_id}/voter-registry` | 유권자 명부 업로드, 검증, 확정 |
| Invitation API | `/api/v1/admin/elections/{election_id}/invitations` | 초대 발송/재발송/상태 조회 |
| VotingCredential / CredentialEvent API | `/api/v1/admin/elections/{election_id}/credentials` | 인증 상태와 제한된 인증 이벤트 조회 |
| Voter Portal API | `/api/v1/voter` | 초대 확인, 유권자 식별, 투표자용 상태 조회 |
| Anonymous Ballot / Vote API | `/api/v1/voter/elections/{election_id}/ballots` | 익명/기명 투표 제출, 재투표 제출, 완료 확인 |
| Result / ResultVersion API | `/api/v1/admin/elections/{election_id}/results` | 집계, 확정, 공개, 정정 |
| Report API | `/api/v1/admin/elections/{election_id}/reports` | 보고서 생성/다운로드 |
| Dispute / Correction / Invalidation API | `/api/v1/admin/elections/{election_id}` | 이의제기, 정정, 무효 처리 |
| OperationIncident API | `/api/v1/admin/elections/{election_id}/incidents` | 장애/운영 사고 등록/해결 |
| Audit / Security Log API | `/api/v1/admin/logs` | 감사/보안/DB 접근 로그 조회 |
| Notification / Delivery API | `/api/v1/admin/notifications` | 알림 템플릿과 발송 이력 |
| Retention / Deletion API | `/api/v1/admin/retention` | 보관 정책과 개인정보 파기 요청 |

## 3. 관리자 API 상세 설계

아래 표의 Request/Response는 핵심 필드만 정의한다. 실제 스키마 작성 시 권한별 field policy를 반드시 반영한다.

### 3.1 Auth / Session API

| API 이름 | Method / Path | 목적 | Role 또는 Permission | 요청 파라미터 / Body | Response Body | 상태 코드 | 주요 검증 규칙 | 감사 로그 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 관리자 로그인 | `POST /api/v1/admin/auth/login` | 관리자 세션 시작 | 관리자 계정 | `username`, `password` | `mfa_required`, `session_state`, 제한된 `user` | 200, 401, 423 | 계정 상태, 비밀번호, 잠금 확인 | SecurityEvent `login_success/login_failed` | 실패 사유 세부 노출 금지, 세션 토큰 로그 금지 | `users`, `security_events` | 관리자 로그인 |
| MFA 검증 | `POST /api/v1/admin/auth/mfa/verify` | MFA 완료 | 관리자 계정 | `method_type`, `otp` 또는 WebAuthn assertion | `session`, `user`, `permissions` | 200, 401, 423 | MFA 등록/상태/실패 횟수 | SecurityEvent `mfa_success/mfa_failed` | MFA secret 원문 저장/응답 금지 | `user_mfa_methods`, `security_events` | MFA 화면 |
| Step-up 요청 | `POST /api/v1/admin/auth/step-up` | 위험 작업 재인증 | 로그인 관리자 | `purpose`, `password_or_mfa` | `step_up_state`, `expires_at` 또는 one-time opaque handle | 200, 401 | 목적과 위험 권한 확인 | SecurityEvent, AuditEvent 조건부 | handle 원문 로그 금지, 짧은 TTL 필수 | `security_events`, `audit_events` | 위험 작업 확인 |
| 세션 조회 | `GET /api/v1/admin/auth/session` | 현재 세션/권한 확인 | 로그인 관리자 | 없음 | `user`, `organization_scope`, `permissions`, `mfa_state` | 200, 401 | 세션 만료/조직 범위 | 없음 또는 SecurityEvent | 권한은 최소 필요 범위로 반환 | `users`, `user_roles` | 전역 |
| 로그아웃 | `POST /api/v1/admin/auth/logout` | 세션 종료 | 로그인 관리자 | 없음 | `ok` | 204 | 세션 유효성 | SecurityEvent 선택 | 세션 ID 원문 로그 금지 | `security_events` | 전역 |

### 3.2 Organization / User / Role / Permission API

| API 이름 | Method / Path | 목적 | Permission | 요청 파라미터 / Body | Response Body | 상태 코드 | 주요 검증 규칙 | 감사 로그 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 조직 설정 조회 | `GET /api/v1/admin/organizations/{organization_id}` | 조직 기본 설정 조회 | `organization.read` | path `organization_id` | `organization`, `settings`, `retention_summary` | 200, 403 | tenant scope 검증 | 없음 | secret/provider credential 제외 | `organizations`, `retention_policies` | 조직 설정 |
| 조직 설정 수정 | `PATCH /api/v1/admin/organizations/{organization_id}` | 조직 정책 수정 | `organization.update` | `timezone`, `allowed_auth_methods`, `notification_defaults` | 수정된 설정 | 200, 400, 403 | 최소 보안 기준 하향 금지 | AuditEvent `organization.updated` | 유료 인증 활성화는 명시 확인 | `organizations`, `organization_authentication_methods` | 조직 설정 |
| 관리자 목록 | `GET /api/v1/admin/organizations/{organization_id}/users` | 관리자 조회 | `user.read` | filter `status`, `role` | paged `users` | 200 | 조직 범위 | 없음 | 계정명/이름 마스킹 기본 | `users`, `user_roles` | 관리자 관리 |
| 관리자 초대 | `POST /api/v1/admin/organizations/{organization_id}/users` | 관리자 초대 | `user.invite` | `username`, `name`, `roles` | invited user summary | 201, 409 | 중복 계정명, role 부여 가능 여부 | AuditEvent `user.invited` | 계정명 원문 응답 지양, 마스킹 | `users`, `user_roles` | 관리자 관리 |
| Role/Permission 조회 | `GET /api/v1/admin/organizations/{organization_id}/roles` | Role과 권한 조회 | `role.read` | 없음 | `roles`, `permissions` | 200 | scope 검증 | 없음 | critical 권한 표시 | `roles`, `permissions`, `role_permissions` | 권한 관리 |
| 사용자 Role 변경 | `PUT /api/v1/admin/organizations/{organization_id}/users/{user_id}/roles` | Role 부여/회수 | `role.assign` | `roles`, `reason`, `step_up_token` | updated role summary | 200, 400, 403 | critical 권한 step-up, 자기 권한 과다 변경 제한 | AuditEvent `role.changed` | 변경 전/후 기록, MFA secret 제외 | `user_roles`, `audit_events` | 권한 관리 |

### 3.3 Election API

| API 이름 | Method / Path | 목적 | Permission | 요청 파라미터 / Body | Response Body | 상태 코드 | 주요 검증 규칙 | 감사 로그 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 투표 목록 조회 | `GET /api/v1/admin/elections` | 조직 투표 목록 | `election.read` | `organization_id`, `state`, `date_range`, pagination | paged election summaries | 200 | 조직 scope, 권한 필터 | 없음 | 참여율은 집계만 | `elections`, `election_policies` | 투표 목록 |
| 투표 상세 조회 | `GET /api/v1/admin/elections/{election_id}` | 투표 설정/상태 상세 | `election.read` | path `election_id` | `election`, `policy`, `auth_policy`, `state_history_summary` | 200, 403, 404 | 조직 scope | 없음 | 익명투표 개인 제출 상세 제외 | `elections`, `election_policies`, `authentication_policies` | 투표 상세 |
| 투표 생성 | `POST /api/v1/admin/elections` | 새 Election 초안 생성 | `election.create` | `organization_id`, `title`, `description`, `type`, `schedule`, `policies` | created election | 201, 400 | 일정 유효성, 기본 AuthenticationPolicy 생성 | AuditEvent `election.created` | 설명에 PII 금지 안내 | `elections`, `election_policies`, `authentication_policies` | 투표 생성 마법사 |
| 투표 수정 | `PATCH /api/v1/admin/elections/{election_id}` | Draft/허용 상태 설정 수정 | `election.update` | 수정 필드 | updated election | 200, 400, 409 | 시작/종료 후 핵심 설정 수정 금지 | AuditEvent `election.updated` | 변경 전/후 요약에 PII 금지 | `elections`, `election_change_histories` | 투표 상세 |
| 검수 요청 | `POST /api/v1/admin/elections/{election_id}/review-request` | Draft를 검수 대기로 전환 | `election.request_review` | `checklist`, `reason` | new state | 200, 409 | 필수 설정/문항/명부 검증 | AuditEvent `election.review_requested` | 명부 원문 요약 금지 | `election_state_histories` | 검수 요청 |
| 투표 승인 | `POST /api/v1/admin/elections/{election_id}/approve` | ReadyForReview 승인 | `election.approve` | `approval_comment`, `step_up_token` | new state | 200, 403, 409 | 승인자 권한, 체크리스트 완료 | AuditEvent `election.approved` | 작성자/승인자 분리 권장 | `election_state_histories` | 검수/승인 |
| 투표 반려 | `POST /api/v1/admin/elections/{election_id}/reject` | ReadyForReview를 Draft로 반려 | `election.approve` | `reason` | new state | 200, 409 | 상태 검증 | AuditEvent `election.rejected` | 사유에 PII 금지 | `election_state_histories` | 검수/승인 |
| 투표 시작 | `POST /api/v1/admin/elections/{election_id}/open` | 수동 시작 또는 예약 시작 보정 | `election.open` | `reason`, `step_up_token` | new state | 200, 409 | Approved/Scheduled/Notice만 허용 | AuditEvent `election.opened` | 시작 후 수정 제한 안내 | `election_state_histories` | 상태 관리 |
| 투표 일시중단 | `POST /api/v1/admin/elections/{election_id}/pause` | 진행 중 투표 일시중단 | `election.pause` | `reason`, `notice`, `step_up_token` | new state | 200, 409 | Open만 허용 | AuditEvent, OperationIncident 선택 | 선택 내용 접근 금지 | `election_state_histories`, `operation_incidents` | 중단/재개/종료 |
| 투표 재개 | `POST /api/v1/admin/elections/{election_id}/resume` | Paused에서 재개 | `election.resume` | `reason`, `step_up_token` | new state | 200, 409 | Paused만 허용 | AuditEvent `election.resumed` | 장애 해소 확인 | `election_state_histories` | 중단/재개/종료 |
| 투표 종료 | `POST /api/v1/admin/elections/{election_id}/close` | 투표 종료 또는 조기 종료 | `election.close` | `reason`, `notice`, `step_up_token` | new state | 200, 409 | Open/Paused만 허용, 조기 종료 사유 필수 | AuditEvent `election.closed` | 종료 후 제출 불가 | `election_state_histories` | 중단/재개/종료 |

### 3.4 Question / Option API

| API 이름 | Method / Path | 목적 | Permission | 요청 파라미터 / Body | Response Body | 상태 코드 | 주요 검증 규칙 | 감사 로그 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 문항 목록 조회 | `GET /api/v1/admin/elections/{election_id}/questions` | 문항/선택지 조회 | `question.read` | 없음 | `questions[]` with options | 200 | election scope | 없음 | 투표 결과/응답 미포함 | `questions`, `options` | 문항 설정 |
| 문항 생성 | `POST /api/v1/admin/elections/{election_id}/questions` | 문항 추가 | `question.write` | `title`, `type`, `required`, `min_select`, `max_select` | created question | 201, 400, 409 | Draft/허용 상태만, 선택 개수 검증 | AuditEvent 또는 ChangeHistory | 문항에 불필요한 PII 금지 | `questions` | 문항 설정 |
| 문항 수정 | `PATCH /api/v1/admin/elections/{election_id}/questions/{question_id}` | 문항 수정 | `question.write` | 수정 필드 | updated question | 200, 409 | Open 이후 수정 금지 | AuditEvent 또는 ChangeHistory | 변경 이력 보존 | `questions`, `election_change_histories` | 문항 설정 |
| 선택지 생성/수정 | `PUT /api/v1/admin/elections/{election_id}/questions/{question_id}/options` | 선택지 일괄 저장 | `question.write` | `options[]` | saved options | 200, 400, 409 | display_order, 중복, Open 이후 금지 | AuditEvent 또는 ChangeHistory | 후보자 개인정보 표시 정책 필요 | `options` | 선택지 설정 |

### 3.5 AuthenticationPolicy API

| API 이름 | Method / Path | 목적 | Permission | 요청 파라미터 / Body | Response Body | 상태 코드 | 주요 검증 규칙 | 감사 로그 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 인증 정책 조회 | `GET /api/v1/admin/elections/{election_id}/authentication-policy` | 투표별 인증 정책 조회 | `auth_policy.read` | 없음 | AuthenticationPolicy | 200 | election scope | 없음 | provider secret 제외 | `authentication_policies` | AuthenticationPolicy 설정 |
| 인증 정책 수정 | `PUT /api/v1/admin/elections/{election_id}/authentication-policy` | 인증 방식 설정 | `auth_policy.write` | 아래 정책값 | updated policy | 200, 400, 409 | Draft/검수 전 허용, 조직 허용 방식 검증 | AuditEvent `authentication_policy.updated` | 인증코드 원문/secret 금지 | `authentication_policies`, `organization_authentication_methods` | AuthenticationPolicy 설정 |
| 조직 허용 인증 방식 조회 | `GET /api/v1/admin/organizations/{organization_id}/authentication-methods` | 조직에서 사용 가능한 인증 방식 조회 | `organization.read` | 없음 | method availability list | 200 | organization scope | 없음 | 비용/provider 상태만 표시 | `organization_authentication_methods` | 조직 설정 |

AuthenticationPolicy request/response 핵심 필드:

| 필드 | 설명 |
| --- | --- |
| `authentication_method` | `invite_link_only`, `invite_link_with_identifier`, `email_code`, `sms_code`, `kakao_message`, `external_identity`, `sso`, `legal_strong_auth` |
| `is_enabled` | 해당 Election에서 활성 여부 |
| `is_paid_method` | 비용 발생 가능 여부. SMS/카카오/외부 본인확인/일부 SSO는 기본 true |
| `provider` | 제공자 코드. secret은 포함하지 않음 |
| `requires_identifier` | 유권자 식별자 확인 필요 여부 |
| `requires_one_time_code` | 1회성 코드 필요 여부 |
| `max_attempts` | 식별/코드 실패 허용 횟수 |
| `lockout_minutes` | 실패 잠금 시간 |
| `code_ttl_minutes` | 코드 방식에서만 의미 있음 |
| `resend_limit` | 코드 방식에서만 의미 있음 |
| `available_in_mvp` | MVP에서 사용 가능 여부 |

MVP 기본값은 `invite_link_with_identifier`이다. 인증코드 관련 설정은 `email_code`, `sms_code`, `kakao_message`에서만 의미가 있으며 다른 방식에서는 null 또는 응답 제외가 원칙이다. 비용 발생 인증 방식은 기본 비활성이다.

### 3.6 VoterRegistry / EligibleVoter API

| API 이름 | Method / Path | 목적 | Permission | 요청 파라미터 / Body | Response Body | 상태 코드 | 주요 검증 규칙 | 감사 로그 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 명부 상태 조회 | `GET /api/v1/admin/elections/{election_id}/voter-registry` | 명부 요약 조회 | `voter_registry.read` | 없음 | `status`, `counts`, masked sample | 200 | 권한/상태 검증 | 없음 | 마스킹된 샘플만 | `voter_registries`, `eligible_voters` | 명부 등록/검증 |
| 명부 업로드 | `POST /api/v1/admin/elections/{election_id}/voter-registry/imports` | 파일 업로드 | `voter_registry.write` | multipart file, `mapping` | import summary | 201, 400, 409 | Draft/허용 상태, 파일 형식, 필수 필드 | AuditEvent `voter_registry.imported` | 원본 파일 암호화/단기 보관 | `voter_registry_imports` | 명부 등록 |
| 명부 검증 실행 | `POST /api/v1/admin/elections/{election_id}/voter-registry/validate` | 중복/누락/형식 검증 | `voter_registry.write` | `import_id` | validation summary | 200, 400 | 이름+외부식별자 기본 검증 | AuditEvent 선택 | 오류 메시지에 PII 원문 금지 | `voter_registry_validation_errors` | 명부 검증 |
| 명부 오류 조회 | `GET /api/v1/admin/elections/{election_id}/voter-registry/errors` | 검증 오류 조회 | `voter_registry.read` | pagination | masked errors | 200 | 권한 검증 | 없음 | 원문 대신 행번호/마스킹 | `voter_registry_validation_errors` | 명부 검증 |
| 명부 확정 | `POST /api/v1/admin/elections/{election_id}/voter-registry/confirm` | 유권자 범위 확정 | `voter_registry.confirm` | `reason`, `step_up_token` | confirmed registry | 200, 409 | 오류 0건, 상태 허용 | AuditEvent `voter_registry.confirmed` | 확정 후 수정 제한 | `voter_registries`, `eligible_voters` | 명부 확정 |
| 유권자 제한 조회 | `GET /api/v1/admin/elections/{election_id}/eligible-voters` | 유권자 목록 조회 | `eligible_voter.read` | filters, pagination | masked voter list | 200 | 권한 검증 | 조회 감사 선택 | 개인정보 마스킹 기본 | `eligible_voters`, `voting_credentials` | 명부 관리 |

### 3.7 Invitation / VotingCredential / CredentialEvent API

| API 이름 | Method / Path | 목적 | Permission | 요청 파라미터 / Body | Response Body | 상태 코드 | 주요 검증 규칙 | 감사 로그 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 초대 생성/발송 | `POST /api/v1/admin/elections/{election_id}/invitations/send` | 유권자 초대 발송 | `invitation.send` | `target`: all/failed/uninvited, `channel` | delivery summary | 202, 409 | Scheduled/Notice/Open 허용, 명부 확정 | AuditEvent, NotificationDelivery | 초대 토큰 원문 응답 금지 | `invitations`, `notification_deliveries` | 초대 관리 |
| 초대 재발송 | `POST /api/v1/admin/elections/{election_id}/invitations/resend` | 초대 재발송 | `invitation.resend` | `target_filter`, `reason` | resend summary | 202, 429 | 재발송 제한, 상태 검증 | AuditEvent, CredentialEvent 조건부 | 인증코드 재발송과 구분 | `invitations`, `credential_events` | 진행 현황 |
| 초대 상태 조회 | `GET /api/v1/admin/elections/{election_id}/invitations` | 초대 발송 상태 조회 | `invitation.read` | filters, pagination | masked invitation status | 200 | 권한 검증 | 없음 | invite_token_hash 미반환 | `invitations` | 초대 관리 |
| 인증 상태 요약 | `GET /api/v1/admin/elections/{election_id}/credentials/summary` | 인증/참여 상태 집계 | `credential.read` | 없음 | counts by status | 200 | 권한 검증 | 없음 | 익명투표는 집계 중심 | `voting_credentials` | 진행 현황 |
| 제한된 유권자별 상태 | `GET /api/v1/admin/elections/{election_id}/credentials/voter-status` | 유권자별 제한 상태 조회 | `credential.read` | filters, pagination | `masked_voter`, `status`: 미참여/참여 완료/인증 문제/초대 실패 | 200 | 권한 검증 | 조회 감사 선택 | 개인별 제출 시각/IP/UA/Ballot ID 금지 | `voting_credentials`, `eligible_voters` | 진행 현황 |
| 인증 이벤트 조회 | `GET /api/v1/admin/elections/{election_id}/credential-events` | 인증 이벤트 제한 조회 | `credential_event.read` | filters | event list | 200 | Auditor/Security 중심 | AuditEvent `log.viewed` | Ballot/SubmissionEvent와 결합 조회 금지 | `credential_events` | 감사 로그 |

## 4. 투표자 API 상세 설계

투표자 API는 초대 링크의 원문 토큰을 직접 계속 사용하지 않는다. 초대 링크 진입 직후 body 기반 token exchange로 짧은 수명의 voter session 또는 invite exchange handle로 교환하고, 이후 투표자 API는 invite token 원문이 아니라 voter session을 기준으로 동작한다. API 응답은 유권자 존재 여부와 내부 식별자를 노출하지 않는다. 초대 토큰 원문은 DB, 응답, application log, access log, error log, APM log에 저장하지 않으며 모든 로깅 계층에서 redaction을 필수로 한다.

| API 이름 | Method / Path | 목적 | 사용 주체 | 요청 파라미터 / Body | Response Body | 상태 코드 | 주요 검증 규칙 | 이벤트 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 초대 링크 확인/token exchange | `POST /api/v1/voter/invitations/verify` | 초대 유효성 확인 및 짧은 voter session 또는 invite exchange handle 발급 | Voter | `{ "invite_token": "..." }` | `invitation_state`, `election_public_summary`, `next_step`, `voter_session_state` 또는 opaque handle metadata | 200, 404, 410 | 토큰 해시, 만료, Election 상태 | CredentialEvent `invite_opened` | invite token 원문 DB/로그/응답 저장 금지, path/query token 금지, 유권자 존재 여부 노출 금지 | `invitations`, `elections` | 초대 링크 진입 |
| 유권자 식별자 확인 | `POST /api/v1/voter/identify` | MVP 기본 인증 | Voter session 또는 invite exchange handle | `name`, `external_identifier` | `voter_session_state`, `auth_state`, `next_step` | 200, 401, 423 | 실패 5회/15분 잠금, 존재 여부 비노출 | CredentialEvent `identifier_check_success/failed` | 어떤 값이 틀렸는지 표시 금지, invite token 원문 불필요 | `eligible_voters`, `voting_credentials` | 유권자 식별자 확인 |
| 선택 인증 단계 조회 | `GET /api/v1/voter/authentication-step` | 다음 인증 단계 확인 | Voter session | voter session | `method`, `requires_code`, `available_actions` | 200, 401 | 인증 정책 확인 | 없음 | 코드 방식이 아니면 코드 필드 미반환 | `authentication_policies`, `voting_credentials` | 선택 인증 |
| 인증코드 요청 | `POST /api/v1/voter/authentication-code/request` | 코드 발송/재발송 | Voter session | `channel` | `sent`, `expires_hint`, `resend_remaining` | 202, 400, 429 | 코드 방식 활성화 여부, 재발송 제한 | CredentialEvent `code_sent/code_resent` | 코드 원문 응답/로그 금지 | `credential_events`, `notification_deliveries` | 선택 인증 |
| 인증코드 검증 | `POST /api/v1/voter/authentication-code/verify` | 코드 인증 | Voter session | `code` | `auth_state`, `next_step` | 200, 401, 410, 423 | 코드 만료/실패/잠금 | CredentialEvent `code_verified/code_failed` | 실패 세부 사유 제한 | `voting_credentials`, `credential_events` | 선택 인증 |
| 투표 정보 조회 | `GET /api/v1/voter/elections/{election_id}` | 투표자용 투표 정보 | Authenticated voter session | 없음 | `title`, `schedule`, `questions_public_preview`, `policy_summary`, `state` | 200, 403, 409 | 인증 상태, 공개 가능 상태 | 없음 | 내부 설정/명부 제외 | `elections`, `questions`, `options` | 투표 정보 확인 |
| 익명/기명 안내 조회 | `GET /api/v1/voter/elections/{election_id}/voting-mode-notice` | 투표 방식 안내 | Authenticated voter session | 없음 | `mode`, `notice`, `limitations` | 200 | 인증 상태 | 없음 | 익명 그룹 식별자 제외 | `election_policies` | 익명/기명 안내 |
| 투표 제출 | `POST /api/v1/voter/elections/{election_id}/ballots` | 신규 제출 | Authenticated voter session | `answers[]`, `client_confirmed_at` 선택 | `submission_status`, `server_received_at`, `receipt_preview`, `can_revote` | 201, 400, 409, 423 | Open 상태, 마감 전 서버 접수, 문항 검증 | SubmissionEvent `submission_accepted/failed` | eligible_voter_id/voting_credential_id/user_id 미노출 | `anonymous_ballot_groups`, `ballots`, `votes`, `vote_options`, `submission_events` | 투표 입력/제출 |
| 재투표 제출 | `POST /api/v1/voter/elections/{election_id}/ballots/revote` | 마감 전 재투표 | Authenticated voter session | `answers[]` | `submission_status`, `server_received_at`, `receipt_preview` | 201, 400, 409 | revote_allowed, Open, 마감 전 | SubmissionEvent `submission_accepted`, superseded | 이전 익명 선택 내용 미반환 | `ballots`, `submission_events` | 재투표 |
| 완료 상태 확인 | `GET /api/v1/voter/elections/{election_id}/completion` | 투표 완료 여부 확인 | Authenticated voter session | 없음 | `has_submitted`, `last_submitted_at`, `receipt_preview` | 200 | 인증 상태 | CredentialEvent 없음 | 선택 내용 반환 금지 | `voting_credentials`, `ballots` 간 직접 응답 연결 금지 | 투표 완료 |
| Receipt 확인 | `GET /api/v1/voter/elections/{election_id}/receipt` | 제한된 접수 증빙 확인 | Authenticated voter session | 없음 | `receipt_preview`, `server_received_at`, `status` | 200, 404 | 본인 세션 한정 | 없음 | 전체 receipt hash, Ballot ID 미반환 | `ballots` | 투표 완료 |
| 결과 열람 | `GET /api/v1/voter/elections/{election_id}/results` | 권한 있는 결과 조회 | Voter/Public 조건 | 없음 | published result summary | 200, 403, 409 | 공개 대상, Published 상태, 소규모 제한 | 없음 | 집계 결과만, 개별 선택 없음 | `result_versions`, `result_items` | 결과 열람 |
| 상태 확인 | `GET /api/v1/voter/elections/{election_id}/status` | 권한 없음/마감/중단 상태 안내 | Voter session | 없음 | `state`, `user_message`, `available_actions` | 200 | 상태별 접근 가능성 | 없음 | invite token 원문 사용 금지, 내부 사유 제외 | `elections` | 오류/마감/중단 |

## 5. 익명투표 API 보안 제약

| 제약 | API 적용 |
| --- | --- |
| 제출 API 식별자 금지 | `POST /voter/elections/{election_id}/ballots`와 `/revote` request/response에 `eligible_voter_id`, `voting_credential_id`, `anonymous_voting_pass_id`, `user_id`를 포함하지 않는다. |
| Ballot/Vote 응답 제한 | 투표자 API는 Ballot ID, Vote ID, AnonymousBallotGroup ID, `ballot_group_token_hash`를 반환하지 않는다. receipt는 제한된 preview만 반환한다. |
| 관리자 응답 제한 | 관리자 API도 특정 유권자의 Ballot ID, Vote ID, AnonymousBallotGroup ID, `ballot_group_token_hash`를 반환하지 않는다. |
| 완료 확인 분리 | 완료 상태 API는 `has_submitted`, 제한된 `last_submitted_at`, `receipt_preview`만 반환하고 선택 내용을 반환하지 않는다. |
| 이전 선택 재표시 금지 | 익명투표 재투표 화면용 API는 이전 answers를 반환하지 않는다. |
| 로그 결합 API 금지 | CredentialEvent와 SubmissionEvent를 개인 단위로 조인하거나 같은 row에 나란히 반환하는 API를 만들지 않는다. |
| 참여 현황 제한 | 관리자 참여 현황 API는 집계 정보 또는 제한 상태값만 반환한다. |
| 상세 제출 정보 제한 | 일반 관리자에게 개인별 상세 제출 시각, IP, User-Agent를 반환하지 않는다. Auditor/SystemAdmin도 유권자와 선택 내용을 연결할 수 없다. |
| 시간 기반 상관분석 방지 | 익명투표에서는 CredentialEvent와 SubmissionEvent를 정밀 시각 기준으로 같은 사용자/관리자 세션에서 동시에 조회하거나 다운로드하지 못하게 한다. 두 로그를 같은 export 파일에 함께 포함하지 않고, 일반 관리자에게 개인별 인증 시각과 제출 시각 비교가 가능한 응답을 제공하지 않는다. |
| 정밀 시각 접근 제한 | 필요 시 분 단위/시간 단위 bucket 또는 마스킹된 시각을 제공한다. 원본 정밀 시각 접근은 보안 담당/감사자에게도 제한하며 별도 승인과 사유가 필요하다. |

## 6. 상태 전환 API 설계

상태 전환 API는 개별 명령형 endpoint를 사용한다. 모든 상태 전환은 `election_state_histories`와 AuditEvent를 남긴다.

| 상태 전환 | API | Permission | Step-up | 사유 | 승인 | AuditEvent | 금지 조건 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Draft -> ReadyForReview | `POST /admin/elections/{id}/review-request` | `election.request_review` | 불필요 | 선택 | 불필요 | `election.review_requested` | 필수 문항/정책/명부 누락 |
| ReadyForReview -> Draft | `POST /admin/elections/{id}/reject` | `election.approve` | 불필요 | 필수 | 승인자 반려 | `election.rejected` | ReadyForReview가 아님 |
| ReadyForReview -> Approved | `POST /admin/elections/{id}/approve` | `election.approve` | 필요 | 선택/권장 | 필요 | `election.approved` | 검수 체크 실패, 권한 부족 |
| Approved -> Scheduled | `POST /admin/elections/{id}/schedule` | `election.schedule` | 조건부 | 선택 | 필요 | `election.scheduled` | 시작 시각 누락/과거 |
| Scheduled / Notice -> Open | `POST /admin/elections/{id}/open` | `election.open` | 필요 | 수동 시작 시 필수 | 조건부 | `election.opened` | 명부 미확정, 승인 없음 |
| Open -> Paused | `POST /admin/elections/{id}/pause` | `election.pause` | 필요 | 필수 | 권장 | `election.paused` | Open 아님 |
| Paused -> Open | `POST /admin/elections/{id}/resume` | `election.resume` | 필요 | 필수 | 권장 | `election.resumed` | Paused 아님, Incident 미해결 |
| Open / Paused -> Closed | `POST /admin/elections/{id}/close` | `election.close` | 필요 | 조기 종료 시 필수 | 권장 | `election.closed` | 이미 Closed 이후 |
| Closed -> Tallying | `POST /admin/elections/{id}/results/tally` | `result.tally` | 조건부 | 선택 | 불필요 | `result.tally_started` | Closed 아님 |
| Tallying -> PendingConfirmation | system/result API | `result.tally` | 불필요 | 없음 | 불필요 | `result.tallied` | 집계 실패 |
| PendingConfirmation -> Confirmed | `POST /admin/elections/{id}/results/{result_id}/confirm` | `result.confirm` | 필요 | 필수 | 필요 | `result.confirmed` | 검수 실패, 이의 처리 미완료 |
| Confirmed -> Published | `POST /admin/elections/{id}/results/versions/{version_id}/publish` | `result.publish` | 필요 | 필수 | 권장 | `result.published` | 공개 대상 미확정 |
| Published -> CorrectionRequest | `POST /admin/elections/{id}/correction-requests` | `result.correct.request` | 필요 | 필수 | 요청 생성 | `correction.requested` | 기존 결과 직접 수정 시도 |
| Published -> Invalidated | `POST /admin/elections/{id}/invalidate` | `election.invalidate` | 필요 | 필수 | 필수 | `election.invalidated` | 승인자 부족, 사유 누락 |
| Any allowed state -> Invalidated | `POST /admin/elections/{id}/invalidate` | `election.invalidate` | 필요 | 필수 | 필수 | `election.invalidated` | 이미 Archived 또는 권한 부족 |

## 7. Result / ResultVersion / Report API 설계

| API 이름 | Method / Path | 목적 | Permission | Request Body | Response Body | 상태 코드 | 검증 규칙 | 감사 로그 | 보안/개인정보 주의사항 | 관련 테이블 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 집계 실행 | `POST /api/v1/admin/elections/{election_id}/results/tally` | 공식 조건으로 집계 실행 | `result.tally` | `reason` | `result_id`, `status` | 202, 409 | Closed 상태, current accepted Ballot만 | AuditEvent `result.tally_started` | 개별 Ballot/Vote 식별자 미반환 | `results`, `result_items` | 결과 검수 |
| 집계 결과 조회 | `GET /api/v1/admin/elections/{election_id}/results/{result_id}` | 확정 전 결과 검수 | `result.read` | 없음 | result summary/items | 200 | 권한/상태 | 조회 감사 선택 | 소규모 익명 제한 경고 | `results`, `result_items` | 결과 검수 |
| ResultVersion 생성 | `POST /api/v1/admin/elections/{election_id}/results/{result_id}/versions` | 공식 결과 버전 생성 | `result.version.create` | `version_type`, `notice` | `result_version` | 201, 409 | 덮어쓰기 금지, version 증가 | AuditEvent `result_version.created` | 기존 공개 결과 보존 | `result_versions` | 결과 확정 |
| 결과 확정 | `POST /api/v1/admin/elections/{election_id}/results/{result_id}/confirm` | 결과 확정 | `result.confirm` | `reason`, `step_up_token` | confirmed version | 200, 409 | PendingConfirmation 상태 | AuditEvent `result.confirmed` | 선택 내용 개인 연결 금지 | `result_versions` | 결과 확정 |
| 결과 공개 | `POST /api/v1/admin/elections/{election_id}/results/versions/{version_id}/publish` | 확정 결과 공개 | `result.publish` | `reason`, `step_up_token` | published version | 200, 409 | Confirmed 상태, 공개 정책, 소규모 제한 | AuditEvent `result.published` | Published 이후 덮어쓰기 금지 | `result_versions` | 결과 공개 |
| 공개 결과 조회 | `GET /api/v1/public/elections/{election_id}/results` | 전체 공개 결과 조회 | PublicViewer | 없음 | public result | 200, 403, 409 | Published, 공개 대상 | 없음 | 비공개/제한 결과 차단 | `result_versions`, `result_items` | 결과 열람 |
| 정정 요청 | `POST /api/v1/admin/elections/{election_id}/correction-requests` | Published 이후 정정 요청 | `result.correct.request` | `result_version_id`, `reason`, `proposed_notice`, `step_up_token` | correction request | 201, 409 | Published 상태 | AuditEvent `correction.requested` | 기존 결과 수정 금지 | `correction_requests` | 정정 요청 |
| 정정 승인 | `POST /api/v1/admin/elections/{election_id}/correction-requests/{request_id}/approve` | 정정 승인 및 새 버전 준비 | `result.correct.approve` | `reason`, `step_up_token` | approved request, new version ref | 200, 409 | 이중 승인, version 생성 | AuditEvent `correction.approved` | 새 ResultVersion만 허용 | `correction_requests`, `result_versions` | 정정 승인 |
| 무효 처리 | `POST /api/v1/admin/elections/{election_id}/invalidate` | 투표 무효 처리 | `election.invalidate` | `reason`, `evidence_summary`, `notice`, `step_up_token` | invalidation record | 200, 409 | 승인자/상태/사유 | AuditEvent `election.invalidated` | 기존 공개 결과와 무효 공지 보존 | `invalidation_records` | 무효 처리 |
| 보고서 생성 | `POST /api/v1/admin/elections/{election_id}/reports` | 보고서 생성 | `report.create` | `report_type`, `result_version_id` | report job | 202 | 상태/권한 | AuditEvent `report.created` | 포함/제외 필드 검증 | `reports` | 보고서 출력 |
| 보고서 export 요청 | `POST /api/v1/admin/reports/{report_id}/export-requests` | 보고서 다운로드 요청 생성 | `report.export.request` | `purpose`, `format`, `scope`, `reason`, `step_up_state` | `export_id`, `status`, `expires_at` | 202, 403, 409 | 목적 입력, 권한, 상태, 필요 시 승인 | AuditEvent `report.export_requested`, ReportExport | 목적을 URL query에 넣지 않음, 민감 필드 제외/마스킹 | `reports`, `report_exports` | 보고서 출력 |
| 보고서 export 다운로드 | `GET /api/v1/admin/report-exports/{export_id}/download` | 승인된 보고서 파일 다운로드 | `report.export.download` | 없음 | file stream | 200, 403, 410 | 승인 상태, 만료 시간, 권한 | AuditEvent `report.export_downloaded` | 워터마크 또는 export id 포함, 만료 링크, 재배포 금지 안내 | `report_exports` | 보고서 출력 |

소규모 익명투표 공개 제한은 결과 조회/공개/보고서 생성 API에서 기본 차단/마스킹 정책으로 표현한다.

| 기준 | API 정책 |
| --- | --- |
| 유권자 수 10명 미만 | 득표수 공개를 기본 차단한다. 조직은 이 기준을 완화할 수 없고 더 엄격하게만 설정할 수 있다. |
| 특정 선택지 득표 3표 미만 | 해당 선택지 득표수 공개를 마스킹하거나 차단한다. |
| 관리자 공개 전 검수 | `privacy_risk_level`, `can_publish_counts`, `masked_result_items`, `required_action`을 반환해 위험 경고와 필요한 조치를 표시한다. |
| PublicViewer 응답 | 익명성을 해치는 상세 수치, 내부 기준 계산값, 작은 집단 추론에 필요한 보조 정보를 반환하지 않는다. |
| 에러/차단 | 공개 불가 시 `SMALL_GROUP_RESULT_RESTRICTED`를 반환하고 사용자용 메시지는 단순화한다. |

## 8. Dispute / Incident / Retention / Notification API

| API 이름 | Method / Path | 목적 | Permission | Request Body | Response Body | 이벤트 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 이의제기 목록 | `GET /api/v1/admin/elections/{election_id}/disputes` | 이의제기 조회 | `dispute.read` | filter | paged disputes | 조회 감사 선택 | 이의제기 관리 |
| 이의제기 처리 | `POST /api/v1/admin/elections/{election_id}/disputes/{dispute_id}/resolve` | 접수/검토 결과 처리 | `dispute.resolve` | `decision`, `reason` | resolved dispute | AuditEvent `dispute.resolved` | 이의제기 관리 |
| Incident 등록 | `POST /api/v1/admin/elections/{election_id}/incidents` | 장애/운영 사고 등록 | `incident.create` | `type`, `severity`, `impact_summary` | incident | AuditEvent `incident.created` | Incident 관리 |
| Incident 해결 | `POST /api/v1/admin/elections/{election_id}/incidents/{incident_id}/resolve` | 장애 조치 완료 | `incident.resolve` | `resolution`, `ended_at` | incident | AuditEvent `incident.resolved` | Incident 관리 |
| 알림 템플릿 조회 | `GET /api/v1/admin/notifications/templates` | 알림 문구 조회 | `notification.read` | filter | templates | 없음 | 조직 설정 |
| 알림 발송 이력 | `GET /api/v1/admin/notifications/deliveries` | 발송 이력 조회 | `notification.read` | filter | masked deliveries | 조회 감사 선택 | 초대/알림 관리 |
| 보관 정책 조회 | `GET /api/v1/admin/retention/policies` | 보관/파기 정책 조회 | `retention.read` | organization filter | policies | 없음 | 개인정보 보관/파기 |
| 개인정보 파기 요청 | `POST /api/v1/admin/retention/deletion-requests` | 파기 요청 생성 | `retention.delete.request` | `election_id`, `data_category`, `reason` | deletion request | AuditEvent `deletion.requested` | 파기 관리 |
| 개인정보 파기 승인 | `POST /api/v1/admin/retention/deletion-requests/{request_id}/approve` | 파기 승인 | `retention.delete.approve` | `reason`, `step_up_token` | deletion job | AuditEvent `deletion.approved` | 파기 관리 |

## 9. 로그/API 감사 설계

| 이벤트 | 발생 API | event_type 예시 | actor | target | 저장 가능한 정보 | 저장 금지 정보 | 접근 가능한 Role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AuditEvent | 투표 생성/수정/승인/중단/종료/확정/공개/권한 변경/보고서 export/로그 조회 | `election.created`, `election.paused`, `result.published`, `report.export_downloaded`, `log.viewed` | 관리자 User | Election, ResultVersion, Report, Role | actor id, target id, 사유, 전후 상태 요약, 시각, risk level | 토큰 원문, 인증코드, 세션 토큰, 민감 PII 원문, 투표 선택 원문 | Auditor, Owner, 제한된 SystemAdmin |
| SecurityEvent | 로그인, MFA, step-up, 의심 접근 | `login_failed`, `mfa_failed`, `step_up_success`, `suspicious_access` | 관리자 또는 system | User/session class | masked IP, UA summary, risk level, 결과 | 세션 토큰, MFA secret, password | Security, Owner, 제한된 Auditor |
| CredentialEvent | 초대 열람, 식별자 확인, 코드 발송/검증, 외부 인증 결과 | `invite_opened`, `identifier_check_failed`, `code_sent`, `external_auth_success` | Voter credential context | VotingCredential | event type, method, channel, success, failure code, occurred_at | Ballot ID, Vote ID, AnonymousBallotGroup ID, 인증코드 원문 | 제한된 Auditor/Security. 일반 관리자에는 요약만 |
| SubmissionEvent | 투표 제출 성공/실패/불명확/마감 후 거절 | `submission_accepted`, `submission_failed`, `late_rejected`, `superseded` | anonymous submission context | Ballot 또는 Election | server_received_at, acceptance_status, reason code, masked IP/UA summary | EligibleVoter ID, VotingCredential ID, User ID, IP 원문, UA 원문 | Auditor/Security 제한. 개인 단위 결합 금지 |
| DbAccessEvent | DB 긴급 접근 | `db_access_started`, `db_access_finished`, `db_access_reviewed` | 운영자/SystemAdmin | target area | 접근 사유, 승인자, 시작/종료, row count summary | query 원문, 결과 원문, 민감 PII 원문 | Security, Auditor, 제한된 SystemAdmin |

로그 조회 API 자체는 AuditEvent `log.viewed`를 남긴다. 익명투표에서 CredentialEvent와 SubmissionEvent를 개인 단위로 연결하는 조회 API, 다운로드, 보고서는 만들지 않는다.

익명투표 로그 상관분석 방지 정책:

- CredentialEvent와 SubmissionEvent를 개인 단위로 연결하는 API를 만들지 않는다.
- 두 로그를 같은 export 파일에 함께 포함하지 않는다.
- 두 로그의 정밀 timestamp를 일반 관리자에게 동시에 제공하지 않는다.
- 일반 관리자에게 개인별 인증 시각과 제출 시각의 비교가 가능한 응답을 제공하지 않는다.
- 필요 시 시간 bucket, 예를 들어 분 단위/시간 단위 집계 또는 마스킹된 시각만 제공한다.
- 원본 정밀 시각 접근은 보안 담당/감사자에게도 제한하며 별도 승인, 사유, step-up, AuditEvent가 필요하다.
- SubmissionEvent 응답에는 EligibleVoter/VotingCredential 관련 식별자를 포함하지 않는다.
- CredentialEvent 응답에는 Ballot/AnonymousBallotGroup 관련 식별자를 포함하지 않는다.

## 10. Audit / Security Log API

| API 이름 | Method / Path | 목적 | Permission | Request | Response | 검증/제약 | 감사 로그 | 관련 UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 감사 로그 조회 | `GET /api/v1/admin/logs/audit-events` | AuditEvent 조회 | `audit_event.read` | filters | paged audit events | 권한별 필드 제한 | AuditEvent `log.viewed` | 감사 로그 |
| 보안 로그 조회 | `GET /api/v1/admin/logs/security-events` | SecurityEvent 조회 | `security_event.read` | filters | paged security events | IP/UA 마스킹 | AuditEvent `security_log.viewed` | 보안 로그 |
| 인증 로그 조회 | `GET /api/v1/admin/logs/credential-events` | CredentialEvent 제한 조회 | `credential_event.read` | filters | paged credential events | Ballot/AnonymousBallotGroup 식별자 금지, 정밀 시각 제한 | AuditEvent `credential_log.viewed` | 감사 로그 |
| 제출 로그 조회 | `GET /api/v1/admin/logs/submission-events` | SubmissionEvent 제한 조회 | `submission_event.read` | filters | paged submission events | EligibleVoter/VotingCredential 식별자 금지, 정밀 시각 제한 | AuditEvent `submission_log.viewed` | 감사 로그 |
| DB 접근 로그 조회 | `GET /api/v1/admin/logs/db-access-events` | DB 접근 감사 조회 | `db_access_event.read` | filters | paged db access events | query/result 원문 없음 | AuditEvent `db_access_log.viewed` | DB 긴급 접근 |
| 로그 export 요청 | `POST /api/v1/admin/log-exports` | Audit/Security/Credential/Submission/DbAccessEvent export 요청 | `log.export.request` | `log_type`, `filters`, `purpose`, `scope`, `step_up_state` | `export_id`, `status`, `expires_at` | 이중 승인 필수, 목적 입력 필수, 범위 제한, 민감 필드 마스킹, 익명투표 연결 금지 | AuditEvent `log.export_requested` | 감사 로그 |
| 로그 export 다운로드 | `GET /api/v1/admin/log-exports/{export_id}/download` | 승인된 로그 export 다운로드 | `log.export.download` | 없음 | file stream | 승인된 export만, 만료 시간, 워터마크/export id, 재배포 금지 안내 | AuditEvent `log.export_downloaded` | 감사 로그 |

로그 다운로드 정책:

- 로그 조회는 Role/Permission에 따라 제한하고, 로그 다운로드는 더 강한 정책을 적용한다.
- AuditEvent, SecurityEvent, CredentialEvent, SubmissionEvent, DbAccessEvent export는 이중 승인, step-up 인증, 목적 입력, 다운로드 범위 제한, 개인정보 및 민감 필드 마스킹, 워터마크 또는 추적 가능한 export id, 만료 시간 있는 다운로드 링크, AuditEvent 기록, 다운로드 파일 재배포 금지 안내가 필수이다.
- 익명투표 관련 로그 export는 CredentialEvent와 SubmissionEvent를 같은 파일에 함께 포함할 수 없다.
- 로그 export API도 보고서 export와 같은 요청 생성 후 승인된 export 다운로드 패턴을 사용한다.

## 11. 권한별 응답 필드 정책

| Role | 반환 가능 필드 | 제한 필드 | 중요 제약 |
| --- | --- | --- | --- |
| ElectionManager | Election 설정, 문항, 명부 마스킹 정보, 초대/인증 요약, 참여 집계 | 결과 확정 전 민감 집계, 감사 로그 상세, 개인별 제출 상세 | 익명투표에서 유권자별 상태는 제한값만 |
| ElectionApprover | 검수 체크리스트, 설정 변경 요약, 상태 전환 정보, 결과 검수 정보 | Ballot/Vote 개인 연결, 토큰/코드 원문 | 위험 작업 step-up 필수 |
| Auditor | Audit/Security/Credential/SubmissionEvent의 제한 필드, 보고서 이력 | 유권자와 Ballot/Vote를 연결하는 필드, IP/UA 원문, 선택 내용 개인 연결 | 익명투표 재식별 가능한 결합 조회 금지 |
| ResultPublisher | 확정된 ResultVersion, 공개 대상, 보고서 생성/다운로드 | 미확정 결과 상세 일부, 개인별 응답 | Published 이후 덮어쓰기 API 없음 |
| OrganizationOwner | 조직 설정, 사용자/Role, 보관 정책, 제한된 운영 현황 | 익명투표 개인별 선택/제출 상세 | 권한 변경은 AuditEvent 필수 |
| SystemAdmin | Tenant/시스템 운영 정보, 제한된 보안/DB 접근 로그 | 조직 투표의 익명 선택 내용을 개인 단위로 추적할 수 있는 응답 | DB 직접 접근은 긴급 절차로만 |
| Voter | 본인 투표 가능 상태, 투표 정보, 완료 여부, 제한 receipt, 허용 결과 | 내부 유권자 ID, Ballot/Vote ID, 이전 익명 선택 내용 | 존재 여부 비노출 |
| PublicViewer | 전체 공개 ResultVersion과 공개 보고서 | 비공개 결과, 참여자 전용 결과, 개별 응답 | 공개 정책에 맞는 필드만 |

모든 Role에 공통으로 적용되는 금지 응답:

- 토큰 원문, 인증코드 원문, 세션 식별자 원문
- 익명투표에서 특정 유권자와 Ballot/Vote를 연결하는 식별자 조합
- `ballot_group_token_hash`
- 일반 관리자 대상 개인별 상세 제출 시각, IP, User-Agent
- Auditor/SystemAdmin 대상이라도 유권자와 선택 내용을 연결할 수 있는 결합 결과

## 12. 에러 응답 설계

| 상황 | HTTP | error.code | 사용자용 메시지 | 관리자용 메시지 | 보안 주의 |
| --- | --- | --- | --- | --- | --- |
| 인증 실패 | 401 | `AUTHENTICATION_FAILED` | 인증에 실패했습니다. 입력 정보를 확인해 주세요. | 로그인 또는 MFA 실패 | 계정 존재 여부 비노출 |
| 권한 없음 | 403 | `PERMISSION_DENIED` | 이 작업을 수행할 권한이 없습니다. | required permission 표시 가능 | 투표자에게 내부 권한명 비노출 |
| 투표 기간 아님 | 409 | `ELECTION_NOT_OPEN` | 아직 투표할 수 없습니다. | 현재 상태와 허용 상태 표시 | 내부 state transition 상세 제한 |
| 투표 마감 | 409 | `ELECTION_CLOSED` | 투표가 마감되었습니다. | 서버 접수 시각이 종료 이후 | 마감 판정은 서버 접수 완료 시각 |
| 투표 일시중단 | 409 | `ELECTION_PAUSED` | 현재 투표가 일시중단되었습니다. | Paused 상태 | 장애 내부 사유 제한 |
| 이미 종료됨 | 409 | `ELECTION_ALREADY_CLOSED` | 이미 종료된 투표입니다. | Closed 이후 상태 | 없음 |
| 재투표 불가 | 409 | `REVOTE_NOT_ALLOWED` | 이 투표는 다시 제출할 수 없습니다. | policy revote_allowed=false | 이전 선택 반환 금지 |
| 유권자 식별 실패 | 401 | `VOTER_IDENTIFICATION_FAILED` | 정보를 확인할 수 없습니다. 다시 입력해 주세요. | identifier check failed | 존재 여부/어느 필드 실패인지 비노출 |
| 인증코드 옵션 비활성 | 400 | `AUTH_CODE_NOT_ENABLED` | 이 투표에서는 인증코드를 사용하지 않습니다. | auth method not code-based | 코드 API 오용 차단 |
| 인증코드 만료 | 410 | `AUTH_CODE_EXPIRED` | 인증코드가 만료되었습니다. | code ttl expired | 코드 값 로그 금지 |
| 결과 미확정 | 409 | `RESULT_NOT_CONFIRMED` | 결과가 아직 확정되지 않았습니다. | PendingConfirmation 이전 | 없음 |
| 결과 비공개 | 403 | `RESULT_NOT_PUBLIC` | 결과를 열람할 수 없습니다. | visibility policy restricted | 공개 대상 추정 제한 |
| 소규모 익명투표 공개 제한 | 403 또는 409 | `SMALL_GROUP_RESULT_RESTRICTED` | 재식별 방지를 위해 일부 결과가 제한됩니다. | small group rule triggered, privacy_risk_level | PublicViewer에게 상세 기준 수치 과다 노출 금지 |
| 상태 전환 불가 | 409 | `INVALID_STATE_TRANSITION` | 현재 상태에서는 수행할 수 없습니다. | from/to state 표시 | 사용자용은 단순화 |
| Published 이후 덮어쓰기 금지 | 409 | `PUBLISHED_RESULT_IMMUTABLE` | 공개된 결과는 직접 수정할 수 없습니다. | CorrectionRequest 필요 | 덮어쓰기 endpoint 금지 |
| 위험 작업 step-up 필요 | 428 | `STEP_UP_REQUIRED` | 보안을 위해 추가 인증이 필요합니다. | step-up token missing/expired | step-up token 원문 로그 금지 |

## 13. MVP API 범위

### MVP 필수 API

| 영역 | API |
| --- | --- |
| 관리자 인증 | 관리자 로그인, MFA 검증, 세션 조회, step-up |
| 투표 관리 | 투표 생성/수정/조회, 검수 요청, 승인, 시작/중단/재개/종료 |
| 문항/선택지 | 문항 목록/생성/수정, 선택지 저장 |
| AuthenticationPolicy | 기본 설정 조회/수정, MVP 기본 `invite_link_with_identifier` |
| VoterRegistry | 명부 업로드, 검증, 오류 조회, 확정 |
| Invitation | 초대 생성/발송, 초대 상태 조회 |
| 투표자 인증 | 초대 링크 확인, 유권자 식별자 확인 |
| 투표자 투표 | 투표 정보 조회, 투표 방식 안내, 제출, 재투표, 완료 상태, receipt |
| 결과 | 집계 실행, 집계 결과 조회, 결과 확정, 결과 공개, 결과 조회 |
| 감사 | 기본 AuditEvent/SecurityEvent/CredentialEvent/SubmissionEvent 기록, 제한 조회 |

### 후순위 API

| 영역 | API |
| --- | --- |
| 유료 인증 | SMS/카카오 인증, 외부 본인확인 |
| 조직 연동 | SSO 설정/인증 |
| 보고서 | 고급 보고서 템플릿, 대량 export, 외부 감사 패키지 |
| 감사 | 고급 감사 로그 검색, 로그 무결성 증명 조회 |
| 운영 | DB 긴급 접근 워크플로 자동화, 고급 Incident 관리 |
| 개인정보 | 개인정보 파기 자동화, 백업 파기 반영 자동 추적 |
| 법적 효력 | 강한 본인확인, 전자서명, 법적 증빙 보관 |

## 14. 최종 정리

### API 설계 요약

- REST JSON 기반 `/api/v1` 구조를 사용한다.
- 관리자 API, 투표자 API, 공개 결과 API를 분리한다.
- 모든 관리자 API는 Tenant/Organization scope와 Permission을 검증한다.
- 투표자 인증은 MVP 기본 `invite_link_with_identifier`이며 1회성 인증코드는 옵션 인증 방식이다.
- 익명투표에서 인증/자격 영역과 Ballot/Vote 영역의 식별자를 API 응답에서도 분리한다.
- Published 이후 결과 덮어쓰기 API는 만들지 않는다.

### 보안상 중요한 API 제약

- 투표 제출/재투표 API는 유권자 식별자를 request/response에 노출하지 않는다.
- 관리자 API도 특정 유권자의 Ballot/Vote/AnonymousBallotGroup/token hash를 반환하지 않는다.
- CredentialEvent와 SubmissionEvent를 개인 단위로 결합하는 API를 만들지 않는다.
- 보고서/로그 export는 목적 입력, step-up, 승인, 만료 링크, 워터마크/export id, AuditEvent를 필수로 한다.
- 투표자 인증 오류는 유권자 존재 여부를 노출하지 않는다.

### UI 구현에서 필요한 API

- 관리자 대시보드: 투표 목록, 상태 요약, 검수 대기, 보안 이벤트 요약
- 투표 생성 마법사: Election, Question/Option, AuthenticationPolicy, VoterRegistry API
- 진행 현황: Invitation 상태, Credential summary, 제한된 voter status
- 투표자 포털: invitation 확인, identifier 확인, election info, voting mode notice, submit/revote/completion/result
- 결과 화면: tally, result read, confirm, publish, public/voter result read
- 감사 화면: audit/security/credential/submission/db access log 제한 조회와 export 요청

### 구현 전에 확인해야 할 사항

- Permission code 최종 목록과 Role별 기본 매핑을 확정해야 한다.
- API 응답 field policy를 OpenAPI 스키마 또는 별도 schema layer에서 어떻게 표현할지 결정해야 한다.
- 코드 기반 인증의 실제 code hash 저장 위치와 만료/재발송 제한 값을 확정해야 한다.
- 소규모 익명투표 공개 제한 기준 수치를 확정해야 한다.
- 로그 무결성 체인, append-only 저장 방식, 다운로드 승인 흐름의 구현 방식을 확정해야 한다.
- 파일 업로드/다운로드의 바이러스 검사, 워터마크, 임시 파일 보관 정책을 확정해야 한다.
- Public result API에서 공개 대상별 접근 제어 방식을 확정해야 한다.
