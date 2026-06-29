# 온라인 투표 서비스 Implementation Guardrail Spec

## 1. 문서 목적과 적용 범위

본 문서는 구현 단계에서 설계 원칙이 깨지지 않도록 반드시 지켜야 할 불변조건, Permission code, Role 매핑, API 응답 필드 노출 정책, 이벤트 기록 지점, OpenAPI 작성 전 스키마 가이드를 고정한다.

기준 문서:

- `docs/online-voting-service-design.md`
- `docs/requirements-enhancement-proposal.md`
- `docs/erd-design.md`
- `docs/ui-design-and-screen-spec.md`
- `docs/api-design.md`

본 문서는 구현 코드, DB migration, API 구현, UI 구현을 포함하지 않는다.

## 2. 구현 불변조건

아래 규칙은 구현 중 타협할 수 없는 불변조건이다. 구현자가 위반 가능성을 발견하면 구현을 멈추고 보고해야 한다.

| ID | 불변조건 | 구현 기준 |
| --- | --- | --- |
| INV-01 | 익명투표에서 Ballot, Vote, AnonymousBallotGroup, SubmissionEvent는 EligibleVoter, VotingCredential, User와 직접 FK로 연결하지 않는다. | DB schema, ORM relation, API response, admin query 모두 해당된다. |
| INV-02 | CredentialEvent는 Ballot, AnonymousBallotGroup, SubmissionEvent와 개인 단위로 연결하지 않는다. | join query, export, admin 화면 응답에서도 금지한다. |
| INV-03 | `ballot_group_token_hash`는 유권자 식별자 기반 해시가 아니라 랜덤 토큰 기반이다. | external id, credential id, eligible voter id, email/phone/name hash에서 재계산 가능하면 안 된다. |
| INV-04 | VotingCredential은 인증코드 객체가 아니라 투표 참여 자격, 인증 상태, 투표권 사용 상태 객체다. | 코드 인증 비활성 Election에서도 VotingCredential은 존재할 수 있다. |
| INV-05 | MVP 기본 인증은 `invite_link_with_identifier`이다. | 이름 + 조직 내 외부 식별자를 기본 식별자로 사용한다. |
| INV-06 | 1회성 인증코드는 투표별 선택 옵션이다. | 코드 재발송/만료/잠금 정책은 코드 방식 Election에만 적용한다. |
| INV-07 | 재투표 시 기존 Ballot을 수정하지 않고 새 Ballot을 생성한다. | 이전 Ballot은 superseded 상태로 이력을 보존한다. |
| INV-08 | 마지막 accepted Ballot만 `is_current = true`가 된다. | 동일 AnonymousBallotGroup 안에서 current Ballot은 최대 1개여야 한다. |
| INV-09 | 공식 집계는 `is_current = true`, `acceptance_status = accepted`, `server_received_at <= election.ends_at` 조건을 만족하는 Ballot만 사용한다. | 사용자 기기 시각, 요청 시작 시각은 공식 마감 판정 기준이 아니다. |
| INV-10 | Published 이후 결과는 덮어쓰지 않는다. | 정정은 CorrectionRequest와 새 ResultVersion, 무효는 InvalidationRecord로 처리한다. |
| INV-11 | 토큰 원문, 인증코드 원문, 세션 토큰, 민감 개인정보 원문은 로그에 저장하지 않는다. | application/access/error/APM 로그 모두 포함한다. |
| INV-12 | invite token은 URL path/query에 넣지 않는다. | body 기반 token exchange 후 짧은 voter session 또는 opaque handle을 사용한다. |
| INV-13 | 로그 다운로드는 이중 승인, step-up, 마스킹, AuditEvent를 필수로 한다. | Audit/Security/Credential/Submission/DbAccessEvent export 모두 해당된다. |
| INV-14 | 익명투표에서 유권자와 Ballot/Vote를 연결하는 API 응답은 누구에게도 제공하지 않는다. | Auditor와 SystemAdmin도 예외가 아니다. |
| INV-15 | 익명투표에서 이전 선택 내용은 투표자에게 재표시하지 않는다. | 완료 여부, 제한된 receipt, 마지막 제출 시각만 허용한다. |
| INV-16 | CredentialEvent와 SubmissionEvent는 정밀 시각 기준으로 같은 export 파일에 함께 포함하지 않는다. | 시간 기반 상관분석을 방지한다. |
| INV-17 | 소규모 익명투표 결과 공개 제한은 완화할 수 없다. | 조직은 더 엄격하게만 설정할 수 있다. |

## 3. Permission Code 최종 목록

위험도 기준:

- `low`: 조회 또는 낮은 영향 작업
- `medium`: 운영 상태나 개인정보 일부에 영향을 주는 작업
- `high`: 투표 진행, 결과, 개인정보, 보고서, 보안 로그에 영향을 주는 작업
- `critical`: 권한, 무효, DB 접근, 로그 export, 대량 개인정보 처리처럼 강한 통제가 필요한 작업

| 영역 | permission code | 설명 | 위험도 | step-up | 사유 입력 | 이중 승인 | AuditEvent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Organization 관리 | `organization.read` | 조직 설정 조회 | low | No | No | No | No |
| Organization 관리 | `organization.update` | 조직 일반 설정 수정 | medium | Conditional | Yes | No | Yes |
| Organization 관리 | `organization.security.update` | 조직 보안/인증 허용 정책 수정 | high | Yes | Yes | Conditional | Yes |
| Organization 관리 | `organization.auth_method.manage` | 조직별 인증 방식 허용/비활성 관리 | high | Yes | Yes | Conditional | Yes |
| User / Role / Permission 관리 | `user.read` | 관리자 목록/상태 조회 | low | No | No | No | No |
| User / Role / Permission 관리 | `user.invite` | 관리자 초대 | medium | Conditional | Yes | No | Yes |
| User / Role / Permission 관리 | `user.update` | 관리자 정보/상태 수정 | medium | Conditional | Yes | No | Yes |
| User / Role / Permission 관리 | `user.disable` | 관리자 계정 비활성화 | high | Yes | Yes | Conditional | Yes |
| User / Role / Permission 관리 | `role.read` | Role/Permission 조회 | low | No | No | No | No |
| User / Role / Permission 관리 | `role.assign` | 사용자 Role 부여/회수 | critical | Yes | Yes | Yes for critical role | Yes |
| User / Role / Permission 관리 | `role.manage` | Role 정의/권한 묶음 관리 | critical | Yes | Yes | Yes | Yes |
| User / Role / Permission 관리 | `permission.read` | Permission 목록 조회 | low | No | No | No | No |
| Election 생성/수정/조회 | `election.read` | 투표 목록/상세 조회 | low | No | No | No | No |
| Election 생성/수정/조회 | `election.create` | 투표 초안 생성 | medium | No | No | No | Yes |
| Election 생성/수정/조회 | `election.update` | Draft/허용 상태 투표 수정 | medium | Conditional | Yes for sensitive change | No | Yes |
| Election 생성/수정/조회 | `election.delete_draft` | Draft 투표 삭제 | medium | Conditional | Yes | No | Yes |
| Election 검수/승인 | `election.request_review` | 검수 요청 | medium | No | Optional | No | Yes |
| Election 검수/승인 | `election.reject` | 검수 반려 | medium | No | Yes | No | Yes |
| Election 검수/승인 | `election.approve` | 투표 승인 | high | Yes | Yes | Conditional | Yes |
| Election 상태 전환 | `election.schedule` | 예약 상태 전환 | medium | Conditional | Optional | No | Yes |
| Election 상태 전환 | `election.open` | 투표 수동 시작 | high | Yes | Yes | Conditional | Yes |
| Election 상태 전환 | `election.pause` | 투표 일시중단 | high | Yes | Yes | Conditional | Yes |
| Election 상태 전환 | `election.resume` | 투표 재개 | high | Yes | Yes | Conditional | Yes |
| Election 상태 전환 | `election.close` | 투표 종료/조기 종료 | high | Yes | Yes | Conditional | Yes |
| Election 상태 전환 | `election.archive` | 투표 보관 처리 | medium | Conditional | Yes | No | Yes |
| Election 상태 전환 | `election.invalidate` | 투표 무효 처리 | critical | Yes | Yes | Yes | Yes |
| AuthenticationPolicy 관리 | `auth_policy.read` | 인증 정책 조회 | low | No | No | No | No |
| AuthenticationPolicy 관리 | `auth_policy.write` | 투표별 인증 정책 수정 | high | Yes for paid/strong auth | Yes | Conditional | Yes |
| VoterRegistry 관리 | `voter_registry.read` | 명부 요약/마스킹 목록 조회 | medium | No | No | No | Optional |
| VoterRegistry 관리 | `voter_registry.import` | 명부 파일 업로드 | high | Conditional | Yes | No | Yes |
| VoterRegistry 관리 | `voter_registry.validate` | 명부 검증 실행 | medium | No | No | No | Optional |
| VoterRegistry 관리 | `voter_registry.confirm` | 명부 확정 | high | Yes | Yes | Conditional | Yes |
| VoterRegistry 관리 | `eligible_voter.read` | 마스킹된 유권자 목록 조회 | medium | No | No | No | Optional |
| Invitation 관리 | `invitation.read` | 초대 상태 조회 | medium | No | No | No | Optional |
| Invitation 관리 | `invitation.send` | 초대 발송 | high | Conditional | Yes | No | Yes |
| Invitation 관리 | `invitation.resend` | 초대 재발송 | medium | Conditional | Yes | No | Yes |
| Invitation 관리 | `invitation.revoke` | 초대 취소 | high | Yes | Yes | Conditional | Yes |
| 투표 진행 현황 조회 | `participation.read` | 참여율 집계 조회 | low | No | No | No | No |
| 투표 진행 현황 조회 | `credential.read` | 인증/참여 상태 요약 조회 | medium | No | No | No | Optional |
| 투표 진행 현황 조회 | `credential_event.read` | 인증 이벤트 제한 조회 | high | Conditional | Yes for precise time | Conditional | Yes |
| 투표 진행 현황 조회 | `submission_event.read` | 제출 이벤트 제한 조회 | high | Conditional | Yes for precise time | Conditional | Yes |
| Result / ResultVersion 관리 | `result.read` | 집계 결과 조회 | medium | No | No | No | Optional |
| Result / ResultVersion 관리 | `result.tally` | 집계 실행 | high | Conditional | Optional | No | Yes |
| Result / ResultVersion 관리 | `result.version.create` | ResultVersion 생성 | high | Yes | Yes | Conditional | Yes |
| Result / ResultVersion 관리 | `result.confirm` | 결과 확정 | high | Yes | Yes | Conditional | Yes |
| Result / ResultVersion 관리 | `result.publish` | 결과 공개 | high | Yes | Yes | Conditional | Yes |
| Report 생성/다운로드 | `report.create` | 보고서 생성 | medium | Conditional | Optional | No | Yes |
| Report 생성/다운로드 | `report.export.request` | 보고서 export 요청 | high | Yes | Yes | Conditional | Yes |
| Report 생성/다운로드 | `report.export.download` | 승인된 보고서 export 다운로드 | high | Yes | Yes | Conditional | Yes |
| Dispute / Correction / Invalidation 관리 | `dispute.read` | 이의제기 조회 | medium | No | No | No | Optional |
| Dispute / Correction / Invalidation 관리 | `dispute.resolve` | 이의제기 처리 | high | Yes | Yes | Conditional | Yes |
| Dispute / Correction / Invalidation 관리 | `result.correct.request` | Published 이후 정정 요청 | high | Yes | Yes | No | Yes |
| Dispute / Correction / Invalidation 관리 | `result.correct.approve` | 정정 승인/새 버전 준비 | critical | Yes | Yes | Yes | Yes |
| Dispute / Correction / Invalidation 관리 | `invalidation.read` | 무효 기록 조회 | medium | No | No | No | Optional |
| Incident 관리 | `incident.read` | Incident 조회 | medium | No | No | No | Optional |
| Incident 관리 | `incident.create` | Incident 등록 | high | Conditional | Yes | No | Yes |
| Incident 관리 | `incident.resolve` | Incident 해결 | high | Conditional | Yes | Conditional | Yes |
| Audit / Security Log 조회 | `audit_event.read` | AuditEvent 제한 조회 | high | Conditional | Yes for sensitive filter | Conditional | Yes |
| Audit / Security Log 조회 | `security_event.read` | SecurityEvent 제한 조회 | high | Conditional | Yes for sensitive filter | Conditional | Yes |
| Audit / Security Log 조회 | `db_access_event.read` | DB 접근 로그 조회 | critical | Yes | Yes | Conditional | Yes |
| Log export | `log.export.request` | 로그 export 요청 | critical | Yes | Yes | Yes | Yes |
| Log export | `log.export.approve` | 로그 export 승인 | critical | Yes | Yes | Yes | Yes |
| Log export | `log.export.download` | 승인된 로그 export 다운로드 | critical | Yes | Yes | Yes | Yes |
| Retention / Deletion 관리 | `retention.read` | 보관/파기 정책 조회 | medium | No | No | No | Optional |
| Retention / Deletion 관리 | `retention.update` | 보관 정책 수정 | high | Yes | Yes | Conditional | Yes |
| Retention / Deletion 관리 | `retention.delete.request` | 개인정보 파기 요청 | high | Yes | Yes | No | Yes |
| Retention / Deletion 관리 | `retention.delete.approve` | 개인정보 파기 승인 | critical | Yes | Yes | Yes | Yes |
| System / Tenant 관리 | `tenant.read` | Tenant 조회 | medium | No | No | No | Optional |
| System / Tenant 관리 | `tenant.manage` | Tenant 상태/구독/시스템 설정 관리 | critical | Yes | Yes | Conditional | Yes |
| System / Tenant 관리 | `system.security.read` | 시스템 보안 상태 조회 | high | Conditional | Yes for sensitive filter | Conditional | Yes |
| System / Tenant 관리 | `db_access.request` | DB 긴급 접근 요청 | critical | Yes | Yes | Yes | Yes |
| System / Tenant 관리 | `db_access.approve` | DB 긴급 접근 승인 | critical | Yes | Yes | Yes | Yes |
| System / Tenant 관리 | `db_access.review` | DB 접근 사후 감사 | critical | Yes | Yes | Conditional | Yes |

## 4. Role별 기본 Permission 매핑

### 4.1 SystemAdmin

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | SaaS 플랫폼 운영자. Tenant와 시스템 상태를 관리하지만 조직 투표의 익명 선택 내용을 개인 단위로 추적할 수 없다. |
| 기본 Permission | `tenant.read`, `tenant.manage`, `system.security.read`, `db_access.request`, `db_access.review`, `security_event.read`, `db_access_event.read` |
| 명시적 금지 Permission | 조직 Election 결과 조작, 익명투표 유권자-Ballot 연결 조회, 일반 상황의 DB 직접 접근 |
| 익명투표에서 볼 수 없는 정보 | 특정 유권자의 선택 내용, Ballot ID, Vote ID, AnonymousBallotGroup ID, `ballot_group_token_hash`, 개인별 인증/제출 연결 정보 |
| 위험 작업 가능 여부 | 가능하나 DB 긴급 접근은 별도 승인, step-up, 사유, 사후 감사 필수 |
| 작은 조직 겸임 가능 여부 | 조직 내부 Role과 겸임하지 않는 것을 원칙으로 한다. |

### 4.2 OrganizationOwner

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 조직 최고 관리자. 조직 설정, 관리자 초대, Role 부여, 보관 정책을 관리한다. |
| 기본 Permission | `organization.read`, `organization.update`, `organization.security.update`, `organization.auth_method.manage`, `user.read`, `user.invite`, `user.update`, `user.disable`, `role.read`, `role.assign`, `permission.read`, `retention.read`, `retention.update`, `audit_event.read` |
| 명시적 금지 Permission | 단독 결과 확정/공개, 익명투표 개인 선택 조회, 로그 export 단독 승인 |
| 익명투표에서 볼 수 없는 정보 | 개인별 상세 제출 시각, IP, User-Agent, Ballot/Vote/group 식별자, 특정 유권자의 선택 내용 |
| 위험 작업 가능 여부 | 가능하나 critical 작업은 step-up과 이중 승인 필요 |
| 작은 조직 겸임 가능 여부 | 가능. 단 critical 권한 겸임은 감사 로그에 남겨야 한다. |

### 4.3 ElectionManager

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 투표 실무 관리자. 투표 생성, 문항/명부/초대 등 운영 준비를 담당한다. |
| 기본 Permission | `election.read`, `election.create`, `election.update`, `election.delete_draft`, `election.request_review`, `question.read`, `question.write`, `auth_policy.read`, `auth_policy.write`, `voter_registry.read`, `voter_registry.import`, `voter_registry.validate`, `eligible_voter.read`, `invitation.read`, `invitation.send`, `invitation.resend`, `participation.read`, `credential.read`, `incident.read`, `incident.create` |
| 명시적 금지 Permission | `election.approve`, `result.confirm`, `result.publish`, `election.invalidate`, `log.export.*`, `role.assign` |
| 익명투표에서 볼 수 없는 정보 | Ballot ID, Vote ID, AnonymousBallotGroup ID, `ballot_group_token_hash`, 개인별 상세 제출 시각, IP, User-Agent, 특정 유권자의 선택 내용 |
| 위험 작업 가능 여부 | 중간 위험 작업 가능. 중단/종료/무효/결과 확정은 단독 불가 |
| 작은 조직 겸임 가능 여부 | ElectionApprover와 겸임 가능하나 권장하지 않으며 승인 행위는 감사 강화 |

### 4.4 ElectionApprover

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 투표 설정 검수, 승인, 상태 전환, 중단/재개/종료를 승인한다. |
| 기본 Permission | `election.read`, `election.approve`, `election.reject`, `election.schedule`, `election.open`, `election.pause`, `election.resume`, `election.close`, `participation.read`, `result.read`, `incident.read`, `incident.resolve` |
| 명시적 금지 Permission | 명부 원문 조회, 익명투표 개인 선택 조회, 로그 export 단독 승인 |
| 익명투표에서 볼 수 없는 정보 | 특정 유권자와 Ballot/Vote 연결 정보, 개인별 상세 제출 시각/IP/User-Agent |
| 위험 작업 가능 여부 | 가능. 상태 전환은 step-up과 사유 입력 필수 |
| 작은 조직 겸임 가능 여부 | 가능하지만 작성자와 승인자 분리를 권장한다. |

### 4.5 Auditor

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 운영 투명성과 분쟁 대응을 위해 제한된 로그와 이력을 열람한다. |
| 기본 Permission | `election.read`, `result.read`, `report.create`, `audit_event.read`, `security_event.read`, `credential_event.read`, `submission_event.read`, `db_access_event.read`, `dispute.read`, `invalidation.read` |
| 명시적 금지 Permission | 투표/결과 상태 변경, Role 변경, 로그 export 단독 승인, 유권자-Ballot 연결 조회 |
| 익명투표에서 볼 수 없는 정보 | 유권자와 선택 내용 연결, CredentialEvent와 SubmissionEvent 개인 단위 결합 결과, 정밀 시각 동시 비교 결과 |
| 위험 작업 가능 여부 | 기본적으로 조회 중심. export는 이중 승인, step-up, 목적 입력 필수 |
| 작은 조직 겸임 가능 여부 | 가능하지만 운영자 Role과 겸임 시 감사 독립성이 약해지므로 표시해야 한다. |

### 4.6 ResultPublisher

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 확정된 결과 공개와 보고서 export를 담당한다. |
| 기본 Permission | `election.read`, `result.read`, `result.publish`, `report.create`, `report.export.request`, `report.export.download` |
| 명시적 금지 Permission | 집계 조건 변경, Published 결과 덮어쓰기, 무효 단독 처리, 익명투표 개인 선택 조회 |
| 익명투표에서 볼 수 없는 정보 | Ballot/Vote 개인 연결, 소규모 공개 제한을 우회하는 상세 결과 |
| 위험 작업 가능 여부 | 결과 공개와 보고서 export 가능. step-up, 사유, AuditEvent 필수 |
| 작은 조직 겸임 가능 여부 | 가능하나 Result confirm 권한과 겸임은 이중 승인으로 통제한다. |

### 4.7 PrivacyAdmin

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 개인정보 보관, 파기, 마스킹 정책을 관리한다. |
| 기본 Permission | `retention.read`, `retention.update`, `retention.delete.request`, `retention.delete.approve`, `eligible_voter.read`, `audit_event.read` |
| 명시적 금지 Permission | 투표 결과 조작, 익명투표 선택 조회, 로그 export 단독 승인 |
| 익명투표에서 볼 수 없는 정보 | 특정 유권자의 선택 내용, Ballot/Vote/group 식별자 |
| 위험 작업 가능 여부 | 파기 승인 가능. critical 작업은 이중 승인 필수 |
| 작은 조직 겸임 가능 여부 | 가능하나 ElectionManager와 겸임 시 파기 승인 독립성에 주의 |

### 4.8 SecurityAdmin

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 보안 이벤트, MFA, DB 긴급 접근, 로그 export 승인 정책을 관리한다. |
| 기본 Permission | `organization.security.update`, `security_event.read`, `audit_event.read`, `db_access_event.read`, `log.export.request`, `log.export.approve`, `log.export.download`, `db_access.request`, `db_access.approve`, `db_access.review`, `system.security.read` |
| 명시적 금지 Permission | 익명투표 유권자-선택 연결 조회, 결과 덮어쓰기 |
| 익명투표에서 볼 수 없는 정보 | 개인별 선택 내용, CredentialEvent와 SubmissionEvent 결합 결과 |
| 위험 작업 가능 여부 | 가능. 대부분 step-up, 사유, 이중 승인 필요 |
| 작은 조직 겸임 가능 여부 | 가능하지만 Owner와 겸임 시 권한 집중 경고 표시 |

### 4.9 Voter

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 초대받은 유권자. 인증 후 투표, 재투표, 완료 확인, 허용 결과 열람을 수행한다. |
| 기본 Permission | 관리자 Permission 없음. voter session 기반 투표자 API만 사용 |
| 명시적 금지 Permission | 모든 관리자 API, 로그 조회, 명부 조회, 결과 관리 |
| 익명투표에서 볼 수 없는 정보 | 이전 선택 내용, 내부 Ballot ID, Vote ID, AnonymousBallotGroup ID, 전체 receipt hash |
| 위험 작업 가능 여부 | 없음 |
| 작은 조직 겸임 가능 여부 | 관리자 User와 Voter는 개념적으로 분리한다. 같은 사람이 양쪽 지위를 가질 수 있어도 세션/권한은 분리한다. |

### 4.10 PublicViewer

| 항목 | 내용 |
| --- | --- |
| 역할 설명 | 전체 공개 결과를 열람하는 비로그인 또는 제한 열람자. |
| 기본 Permission | 관리자 Permission 없음. 공개 결과 API만 사용 |
| 명시적 금지 Permission | 비공개/참여자 전용 결과, 개별 응답, 로그, 보고서 내부 자료 |
| 익명투표에서 볼 수 없는 정보 | 소규모 재식별 위험이 있는 상세 득표수, 개별 투표 정보 |
| 위험 작업 가능 여부 | 없음 |
| 작은 조직 겸임 가능 여부 | 해당 없음 |

## 5. API 응답 필드 노출 정책

표기:

- `Allowed`: 권한과 상태가 맞으면 노출 가능
- `Masked`: 마스킹 또는 요약만 노출
- `Aggregate`: 집계 단위만 노출
- `SelfOnly`: 투표자 본인 세션에 한해 제한 노출
- `Forbidden`: 노출 금지

| 정보 | ElectionManager | ElectionApprover | Auditor | ResultPublisher | OrganizationOwner | SystemAdmin | Voter | PublicViewer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 유권자 이름 | Masked | Masked | Masked | Forbidden | Masked | Forbidden by default | SelfOnly during auth | Forbidden |
| 유권자 이메일/휴대폰 | Masked | Forbidden | Masked with purpose | Forbidden | Masked | Forbidden by default | SelfOnly if needed | Forbidden |
| 외부 식별자 | Masked | Masked | Masked with purpose | Forbidden | Masked | Forbidden by default | SelfOnly during auth | Forbidden |
| 참여 여부 | Aggregate, limited voter status | Aggregate | Aggregate, limited | Aggregate | Aggregate, limited | Aggregate only | SelfOnly | Forbidden |
| 마지막 제출 시각 | Aggregate only | Aggregate only | Restricted, bucketed | Forbidden | Aggregate only | Forbidden by default | SelfOnly limited | Forbidden |
| 개인별 상세 제출 시각 | Forbidden | Forbidden | Restricted with approval; not combined with CredentialEvent | Forbidden | Forbidden | Forbidden by default | SelfOnly limited | Forbidden |
| Ballot ID | Forbidden | Forbidden | Forbidden for voter-linked views | Forbidden | Forbidden | Forbidden for voter-linked views | Forbidden | Forbidden |
| Vote ID | Forbidden | Forbidden | Forbidden for voter-linked views | Forbidden | Forbidden | Forbidden for voter-linked views | Forbidden | Forbidden |
| AnonymousBallotGroup ID | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden |
| `ballot_group_token_hash` | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden |
| receipt preview | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | Forbidden | SelfOnly | Forbidden |
| IP | Forbidden | Forbidden | Masked with approval | Forbidden | Forbidden | Masked only for security purpose | Forbidden | Forbidden |
| User-Agent | Forbidden | Forbidden | Summary with approval | Forbidden | Forbidden | Summary only for security purpose | Forbidden | Forbidden |
| CredentialEvent 상세 | Summary | Forbidden by default | Restricted, no Ballot link | Forbidden | Summary | Restricted, no Ballot link | Forbidden | Forbidden |
| SubmissionEvent 상세 | Aggregate | Forbidden by default | Restricted, no voter link | Forbidden | Aggregate | Restricted, no voter link | Forbidden | Forbidden |
| Result 상세 | Pre-publish only if permitted | Allowed for review | Allowed | Confirmed/Published only | Allowed if permitted | Aggregate only | Published if eligible | Public only |
| Report 다운로드 링크 | Forbidden by default | Forbidden by default | Approved export only | Approved export only | Approved export only | Approved export only | Forbidden | Public report only |
| AuditEvent 상세 | Forbidden | Forbidden | Allowed with masking | Forbidden | Limited | Limited platform scope | Forbidden | Forbidden |
| SecurityEvent 상세 | Forbidden | Forbidden | Limited | Forbidden | Limited | Allowed with masking | Forbidden | Forbidden |

공통 금지 규칙:

- 익명투표에서 누구도 특정 유권자와 Ballot/Vote를 연결하는 응답을 받을 수 없다.
- Auditor도 익명투표의 선택 내용과 유권자를 연결해 볼 수 없다.
- SystemAdmin도 조직 투표의 익명 선택 내용을 개인 단위로 추적할 수 없다.
- 일반 관리자는 개인별 상세 제출 시각, IP, User-Agent를 볼 수 없다.
- 투표자 본인은 완료 여부와 제한된 receipt 정보만 볼 수 있고, 익명투표에서는 이전 선택 내용을 다시 볼 수 없다.

## 6. API별 AuditEvent / SecurityEvent 발생 지점

| 작업 | event_type | actor | target_type | target_id 저장 | reason 필요 | before/after summary | 저장 금지 정보 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 관리자 로그인 | SecurityEvent `login_success` / `login_failed` | User or unknown admin principal | User | 성공 시 가능, 실패 시 제한 | No | No | password, session token, MFA secret |
| step-up 인증 | SecurityEvent `step_up_success` / `step_up_failed` | User | User / operation purpose | 가능 | Yes for risk operation | No | step-up handle 원문 |
| Role/Permission 변경 | AuditEvent `role.changed` / `permission.changed` | User | UserRole / RolePermission | 가능 | Yes | Yes | MFA secret, session token |
| Election 생성/수정 | AuditEvent `election.created` / `election.updated` | User | Election | 가능 | Conditional | Yes | 명부 원문, 토큰, 민감 PII 원문 |
| 검수 요청 | AuditEvent `election.review_requested` | User | Election | 가능 | Optional | Yes | 명부 원문 |
| 승인/반려 | AuditEvent `election.approved` / `election.rejected` | User | Election | 가능 | Yes for reject, optional for approve | Yes | 민감 PII 원문 |
| 상태 전환 | AuditEvent `election.opened/paused/resumed/closed/archived` | User or system | Election | 가능 | Yes for manual/risk | Yes | 선택 내용, 개인별 제출 상세 |
| 명부 업로드/확정 | AuditEvent `voter_registry.imported/confirmed` | User | VoterRegistry | 가능 | Yes for confirm | Summary only | 원본 파일 내용, 전체 PII |
| 초대 발송 | AuditEvent `invitation.sent/resend_requested` | User or system | Election / InvitationBatch | batch id 가능 | Yes for resend | Summary only | invite token 원문 |
| AuthenticationPolicy 변경 | AuditEvent `authentication_policy.updated` | User | AuthenticationPolicy | 가능 | Yes | Yes | provider secret, 인증코드 원문 |
| 투표 제출 | SubmissionEvent `submission_accepted/failed` | Voter session context | Ballot or Election | Ballot id 가능, voter id 금지 | No | No | EligibleVoter ID, VotingCredential ID, User ID, IP 원문 |
| 재투표 제출 | SubmissionEvent `submission_accepted`, `superseded` | Voter session context | Ballot / AnonymousBallotGroup | Ballot id 가능, voter id 금지 | No | No | 이전 선택 내용의 개인 연결 |
| 집계 실행 | AuditEvent `result.tally_started/tallied` | User or system | Result | 가능 | Optional | Summary | 개별 Ballot/Vote 식별자 |
| 결과 확정 | AuditEvent `result.confirmed` | User | ResultVersion | 가능 | Yes | Yes | 선택 내용 개인 연결 |
| 결과 공개 | AuditEvent `result.published` | User | ResultVersion | 가능 | Yes | Yes | 비공개 결과 원문 |
| 정정 요청/승인 | AuditEvent `correction.requested/approved` | User | CorrectionRequest / ResultVersion | 가능 | Yes | Yes | 조용한 덮어쓰기 정보 없음 |
| 무효 처리 | AuditEvent `election.invalidated` | User | InvalidationRecord / Election | 가능 | Yes | Yes | 불필요한 PII 원문 |
| 보고서 export 요청/다운로드 | AuditEvent `report.export_requested/export_downloaded` | User | ReportExport | 가능 | Yes | Export scope summary | 파일 원문 내용 로그 저장 금지 |
| 로그 조회 | AuditEvent `log.viewed` | User | LogQuery | query id 가능 | Conditional | Query summary | 토큰/코드/세션/민감 PII 원문 |
| 로그 export 요청/다운로드 | AuditEvent `log.export_requested/export_downloaded` | User | LogExport | 가능 | Yes | Export scope summary | 로그 파일 원문 내용, Credential/Submission 결합 데이터 |
| 개인정보 파기 요청/승인 | AuditEvent `deletion.requested/approved/completed` | User / system | DataDeletionRequest / Job | 가능 | Yes | Yes | 파기 대상 PII 원문 |
| DB 긴급 접근 요청/승인 | AuditEvent `db_access.requested/approved`, DbAccessEvent `db_access_started/finished` | User / SystemAdmin | DbAccessEvent | 가능 | Yes | Access scope summary | query/result 원문, 민감 PII 원문 |

## 7. OpenAPI 설계 전 필드 스키마 가이드

아직 OpenAPI 파일을 만들지 않는다. 아래 가이드는 이후 OpenAPI schema 작성 시 필드 노출 정책의 기준이다.

### 7.1 AdminElectionSummary

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `id`, `title`, `state`, `election_type`, `voting_mode`, `authentication_method`, `starts_at`, `ends_at`, `participation_summary`, `result_status` |
| 제외 필드 | Ballot/Vote/group 식별자, 개인별 제출 시각, 토큰/코드 |
| Role별 차이 | Manager/Approver는 운영 CTA 판단용 상태 포함, Auditor는 감사 상태 포함, Publisher는 결과 상태 중심 |
| 마스킹 | 개인정보 없음. 제목/설명에 PII가 있을 수 있으므로 표시 정책 필요 |
| 익명투표 추가 제한 | 참여율은 집계만 포함 |

### 7.2 AdminElectionDetail

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | Election 기본 정보, 정책, AuthenticationPolicy, Question/Option, 명부 요약, 상태 이력 요약, 결과 상태 |
| 제외 필드 | 유권자별 Ballot/Vote 연결, `ballot_group_token_hash`, 개인별 제출 상세 |
| Role별 차이 | Manager는 수정 가능 필드, Approver는 검수 체크리스트, Auditor는 이력 요약, Publisher는 결과 공개 정보 중심 |
| 마스킹 | 명부 샘플은 이름/외부식별자/연락처 마스킹 |
| 익명투표 추가 제한 | 개인별 인증/제출 시각 비교 불가 |

### 7.3 VoterElectionInfo

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `title`, `description`, `schedule`, `state`, `voting_mode_notice`, `result_visibility`, `questions` |
| 제외 필드 | 관리자 메모, 명부 정보, 내부 policy id, Ballot/Vote id |
| Role별 차이 | Voter session에만 제공. PublicViewer에게는 공개 결과 정보만 |
| 마스킹 | 해당 없음 |
| 익명투표 추가 제한 | 이전 선택 내용 반환 금지 |

### 7.4 VoterCompletionStatus

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `has_submitted`, `last_submitted_at`, `receipt_preview`, `can_revote`, `server_time` |
| 제외 필드 | 선택 내용, Ballot ID, Vote ID, 전체 receipt hash, group id |
| Role별 차이 | Voter 본인 session에만 제공 |
| 마스킹 | receipt는 preview만 |
| 익명투표 추가 제한 | 이전 선택 내용 재표시 금지 |

### 7.5 AdminParticipationSummary

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `eligible_count`, `participated_count`, `not_participated_count`, `failed_invitation_count`, `auth_issue_count`, `participation_rate` |
| 제외 필드 | 개인별 상세 제출 시각, IP, User-Agent, Ballot/Vote/group 식별자 |
| Role별 차이 | Manager/Approver는 운영 요약, Auditor는 감사용 집계 |
| 마스킹 | 유권자별 제한 상태가 필요한 경우 이름/외부식별자 마스킹 |
| 익명투표 추가 제한 | 개인별 상태는 `not_participated`, `participated`, `auth_issue`, `invitation_failed` 수준만 |

### 7.6 EligibleVoterAdminView

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `id` 또는 관리용 opaque id, `name_masked`, `external_id_masked`, `email_masked`, `phone_masked`, `status`, 제한된 `participation_status` |
| 제외 필드 | 원문 이름/연락처/외부식별자, Ballot/Vote/group 식별자, 선택 내용 |
| Role별 차이 | Manager/Owner/PrivacyAdmin만 목적에 따라 조회. Approver는 기본적으로 요약 |
| 마스킹 | 기본 마스킹. 원문 복호화 화면은 별도 권한/사유/AuditEvent 필요 |
| 익명투표 추가 제한 | 참여 상태 외 제출 상세 금지 |

### 7.7 ResultSummary

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `result_version_id`, `status`, `published_at`, `questions_summary`, `privacy_risk_level`, `can_publish_counts` |
| 제외 필드 | 개별 Ballot/Vote, 유권자별 선택 |
| Role별 차이 | Publisher/Approver는 공개 검수 정보, Voter/PublicViewer는 공개 범위만 |
| 마스킹 | 소규모 결과 제한에 따라 counts 마스킹 가능 |
| 익명투표 추가 제한 | 유권자 수 10명 미만 또는 선택지 3표 미만 기준 반영 |

### 7.8 ResultDetail

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | 문항별 집계, 선택지별 집계, 비율, 마스킹된 result item, 공개 제한 사유 코드 |
| 제외 필드 | Ballot ID, Vote ID, 유권자 식별 정보 |
| Role별 차이 | 확정 전 상세는 권한자만, 공개 후는 visibility 정책에 따름 |
| 마스킹 | `masked_result_items`로 표현 |
| 익명투표 추가 제한 | PublicViewer에게 상세 제한 기준 과다 노출 금지 |

### 7.9 ReportExport

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `export_id`, `report_id`, `format`, `status`, `requested_by`, `approved_by`, `expires_at`, `watermark_id`, `download_available` |
| 제외 필드 | 파일 내용 inline, 민감 데이터 원문, 장기 다운로드 URL |
| Role별 차이 | 요청자/승인자/감사자에게 상태 표시. 다운로드는 승인된 사용자만 |
| 마스킹 | report 내용 자체도 역할별 필드 제한 적용 |
| 익명투표 추가 제한 | 개별 Ballot/Vote/group 식별자 포함 금지 |

### 7.10 AuditEventView

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `event_id`, `event_type`, `actor_summary`, `target_type`, `target_id`, `risk_level`, `reason`, `occurred_at`, `before_after_summary` |
| 제외 필드 | 토큰/코드/세션 원문, 민감 PII 원문, 선택 내용 원문 |
| Role별 차이 | Auditor/SecurityAdmin/Owner만 제한 조회 |
| 마스킹 | actor와 target은 필요한 범위로 요약 |
| 익명투표 추가 제한 | 유권자-Ballot 연결 target 조합 금지 |

### 7.11 SecurityEventView

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `event_id`, `event_type`, `actor_type`, `actor_summary`, `risk_level`, `ip_masked`, `user_agent_summary`, `occurred_at` |
| 제외 필드 | IP 원문, User-Agent 원문, session token, MFA secret, password |
| Role별 차이 | SecurityAdmin 중심. Owner/Auditor는 제한 |
| 마스킹 | IP는 masked, UA는 summary |
| 익명투표 추가 제한 | 투표 제출 로그와 결합 금지 |

### 7.12 CredentialEventView

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `event_id`, `event_type`, `method`, `channel`, `success`, `failure_reason_code`, 제한된 `occurred_at` 또는 bucket |
| 제외 필드 | Ballot ID, Vote ID, AnonymousBallotGroup ID, 인증코드 원문, invite token 원문 |
| Role별 차이 | 일반 관리자는 요약/집계. Auditor/SecurityAdmin도 정밀 시각은 별도 승인 필요 |
| 마스킹 | 시각 bucket, 실패 사유 코드화 |
| 익명투표 추가 제한 | SubmissionEvent와 개인 단위 결합 금지 |

### 7.13 SubmissionEventView

| 항목 | 내용 |
| --- | --- |
| 포함 필드 | `event_id`, `event_type`, `acceptance_status`, `reason_code`, 제한된 `server_received_at` 또는 bucket |
| 제외 필드 | EligibleVoter ID, VotingCredential ID, User ID, IP 원문, User-Agent 원문, 선택 내용 |
| Role별 차이 | 일반 관리자는 집계. Auditor/SecurityAdmin도 정밀 시각은 별도 승인 필요 |
| 마스킹 | IP masked, UA summary, 시각 bucket |
| 익명투표 추가 제한 | CredentialEvent와 개인 단위 결합 금지 |

## 8. 구현 중 자동 정지 조건

구현 에이전트는 아래 상황을 발견하면 즉시 구현을 멈추고 보고해야 한다.

| 조건 | 중지 이유 |
| --- | --- |
| 익명투표 FK 금지 조건을 위반해야 할 것 같은 경우 | 강한 익명성 붕괴 |
| API 응답에서 유권자와 Ballot/Vote 연결이 필요해 보이는 경우 | 재식별 위험 |
| AuthenticationPolicy가 인증코드 필수 구조로 굳어질 위험이 있는 경우 | MVP 인증 정책 위반 |
| Published 결과를 직접 수정해야 할 것 같은 경우 | 결과 무결성 위반 |
| 로그에 토큰/인증코드/세션/민감 개인정보 원문을 저장해야 할 것 같은 경우 | 보안/개인정보 위반 |
| Permission code 없이 관리자 기능을 구현하게 되는 경우 | RBAC 우회 |
| Role별 필드 노출 정책이 불분명한 경우 | 과다 노출 위험 |
| 테스트가 실패하는 경우 | 회귀 위험 |
| migration이 실패하는 경우 | 데이터 무결성 위험 |
| 설계 문서 간 충돌이 발견되는 경우 | 구현 기준 불명확 |

## 9. 최종 정리

### 구현 시 가장 중요한 10개 guardrail

1. 익명투표에서 유권자/인증 영역과 Ballot/Vote 영역을 직접 연결하지 않는다.
2. API 응답으로 특정 유권자와 Ballot/Vote를 연결하지 않는다.
3. `ballot_group_token_hash`는 랜덤 토큰 기반이어야 한다.
4. VotingCredential을 인증코드 전용 객체로 만들지 않는다.
5. MVP 기본 인증은 `invite_link_with_identifier`이며 인증코드는 선택형이다.
6. 재투표는 새 Ballot 생성으로 처리하고 마지막 accepted Ballot만 current로 둔다.
7. 집계는 공식 Ballot 조건만 사용한다.
8. Published 결과는 덮어쓰지 않고 정정/무효 이력으로 처리한다.
9. 토큰/코드/세션/민감 PII 원문을 로그에 저장하지 않는다.
10. 로그 export는 이중 승인, step-up, 마스킹, AuditEvent 없이는 허용하지 않는다.

### MVP 구현에서 반드시 포함할 Permission

- `organization.read`
- `user.read`
- `role.read`
- `election.read`
- `election.create`
- `election.update`
- `election.request_review`
- `election.approve`
- `election.reject`
- `election.open`
- `election.pause`
- `election.resume`
- `election.close`
- `auth_policy.read`
- `auth_policy.write`
- `voter_registry.read`
- `voter_registry.import`
- `voter_registry.validate`
- `voter_registry.confirm`
- `invitation.read`
- `invitation.send`
- `invitation.resend`
- `participation.read`
- `credential.read`
- `result.read`
- `result.tally`
- `result.confirm`
- `result.publish`
- `report.create`
- `report.export.request`
- `report.export.download`
- `audit_event.read`

### 후순위 Permission

- `tenant.manage`
- `role.manage`
- `organization.auth_method.manage`
- `user.disable`
- `invitation.revoke`
- `credential_event.read`
- `submission_event.read`
- `result.correct.request`
- `result.correct.approve`
- `election.invalidate`
- `incident.create`
- `incident.resolve`
- `security_event.read`
- `db_access_event.read`
- `log.export.request`
- `log.export.approve`
- `log.export.download`
- `retention.update`
- `retention.delete.request`
- `retention.delete.approve`
- `db_access.request`
- `db_access.approve`
- `db_access.review`

### OpenAPI 작성 시 주의할 응답 필드

- Ballot ID, Vote ID, AnonymousBallotGroup ID, `ballot_group_token_hash`는 익명투표 응답에서 금지한다.
- Voter API는 완료 여부와 제한된 receipt만 반환하고 이전 선택 내용을 반환하지 않는다.
- Admin participation API는 집계 또는 제한 상태값만 반환한다.
- CredentialEvent와 SubmissionEvent schema는 결합 조회가 불가능하도록 별도 응답으로 둔다.
- ReportExport와 LogExport는 직접 다운로드 URL을 장기 노출하지 않고 만료와 워터마크/export id를 포함한다.
- Public result schema는 소규모 익명투표 제한을 반영해야 한다.

### 구현 하네스 시작 전 남은 확인 사항

- OpenAPI 파일 생성 방식과 schema naming convention 확정
- Permission seed 데이터와 Role 기본 매핑 seed 방식 확정
- 테스트에서 강제할 익명투표 금지 FK/금지 응답 fixture 정의
- field-level authorization middleware 또는 serializer layer 설계
- token/session redaction을 적용할 logging middleware 범위 확정
- report/log export 파일 저장 위치, 만료, 워터마크 정책 확정
- 소규모 익명투표 제한 수치의 설정 위치와 조직별 더 엄격한 override 방식 확정
