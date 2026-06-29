export const RiskLevel = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical"
});

export const ControlRequirement = Object.freeze({
  NO: "no",
  YES: "yes",
  CONDITIONAL: "conditional"
});

const p = (
  code,
  description,
  risk,
  {
    stepUp = ControlRequirement.NO,
    reason = ControlRequirement.NO,
    dualApproval = ControlRequirement.NO,
    auditEvent = false
  } = {}
) =>
  Object.freeze({
    code,
    description,
    risk,
    stepUp,
    reason,
    dualApproval,
    auditEvent
  });

export const PERMISSIONS = Object.freeze([
  p("organization.read", "조직 설정 조회", RiskLevel.LOW),
  p("organization.update", "조직 일반 설정 수정", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("organization.security.update", "조직 보안/인증 허용 정책 수정", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("organization.auth_method.manage", "조직별 인증 방식 허용/비활성 관리", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("user.read", "관리자 목록/상태 조회", RiskLevel.LOW),
  p("user.invite", "관리자 초대", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("user.update", "관리자 정보/상태 수정", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("user.disable", "관리자 계정 비활성화", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("role.read", "Role/Permission 조회", RiskLevel.LOW),
  p("role.assign", "사용자 Role 부여/회수", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("role.manage", "Role 정의/권한 묶음 관리", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("permission.read", "Permission 목록 조회", RiskLevel.LOW),
  p("election.read", "투표 목록/상세 조회", RiskLevel.LOW),
  p("election.create", "투표 초안 생성", RiskLevel.MEDIUM, { auditEvent: true }),
  p("election.update", "Draft/허용 상태 투표 수정", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("question.read", "문항/선택지 설정 조회", RiskLevel.LOW),
  p("question.write", "문항/선택지 생성/수정", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("election.delete_draft", "Draft 투표 삭제", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("election.request_review", "검수 요청", RiskLevel.MEDIUM, { auditEvent: true }),
  p("election.reject", "검수 반려", RiskLevel.MEDIUM, {
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("election.approve", "투표 승인", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("election.schedule", "예약 상태 전환", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("election.open", "투표 수동 시작", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("election.pause", "투표 일시중단", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("election.resume", "투표 재개", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("election.close", "투표 종료/조기 종료", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("election.archive", "투표 보관 처리", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("election.invalidate", "투표 무효 처리", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("auth_policy.read", "인증 정책 조회", RiskLevel.LOW),
  p("auth_policy.write", "투표별 인증 정책 수정", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("voter_registry.read", "명부 요약/마스킹 목록 조회", RiskLevel.MEDIUM),
  p("voter_registry.import", "명부 파일 업로드", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("voter_registry.validate", "명부 검증 실행", RiskLevel.MEDIUM),
  p("voter_registry.confirm", "명부 확정", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("eligible_voter.read", "마스킹된 유권자 목록 조회", RiskLevel.MEDIUM),
  p("invitation.read", "초대 상태 조회", RiskLevel.MEDIUM),
  p("invitation.send", "초대 발송", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("invitation.resend", "초대 재발송", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("invitation.revoke", "초대 취소", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("participation.read", "참여율 집계 조회", RiskLevel.LOW),
  p("credential.read", "인증/참여 상태 요약 조회", RiskLevel.MEDIUM),
  p("credential_event.read", "인증 이벤트 제한 조회", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.CONDITIONAL,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("submission_event.read", "제출 이벤트 제한 조회", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.CONDITIONAL,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("result.read", "집계 결과 조회", RiskLevel.MEDIUM),
  p("result.tally", "집계 실행", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("result.version.create", "ResultVersion 생성", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("result.confirm", "결과 확정", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("result.publish", "결과 공개", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("report.create", "보고서 생성", RiskLevel.MEDIUM, {
    stepUp: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("report.export.request", "보고서 export 요청", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("report.export.download", "승인된 보고서 export 다운로드", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("dispute.read", "이의제기 조회", RiskLevel.MEDIUM),
  p("dispute.resolve", "이의제기 처리", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("result.correct.request", "Published 이후 정정 요청", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("result.correct.approve", "정정 승인/새 버전 준비", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("invalidation.read", "무효 기록 조회", RiskLevel.MEDIUM),
  p("incident.read", "Incident 조회", RiskLevel.MEDIUM),
  p("incident.create", "Incident 등록", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("incident.resolve", "Incident 해결", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("audit_event.read", "AuditEvent 제한 조회", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.CONDITIONAL,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("security_event.read", "SecurityEvent 제한 조회", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.CONDITIONAL,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("db_access_event.read", "DB 접근 로그 조회", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("log.export.request", "로그 export 요청", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("log.export.approve", "로그 export 승인", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("log.export.download", "승인된 로그 export 다운로드", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("retention.read", "보관/파기 정책 조회", RiskLevel.MEDIUM),
  p("retention.update", "보관 정책 수정", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("retention.delete.request", "개인정보 파기 요청", RiskLevel.HIGH, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    auditEvent: true
  }),
  p("retention.delete.approve", "개인정보 파기 승인", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("tenant.read", "Tenant 조회", RiskLevel.MEDIUM),
  p("tenant.manage", "Tenant 상태/구독/시스템 설정 관리", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("system.security.read", "시스템 보안 상태 조회", RiskLevel.HIGH, {
    stepUp: ControlRequirement.CONDITIONAL,
    reason: ControlRequirement.CONDITIONAL,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  }),
  p("db_access.request", "DB 긴급 접근 요청", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("db_access.approve", "DB 긴급 접근 승인", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.YES,
    auditEvent: true
  }),
  p("db_access.review", "DB 접근 사후 감사", RiskLevel.CRITICAL, {
    stepUp: ControlRequirement.YES,
    reason: ControlRequirement.YES,
    dualApproval: ControlRequirement.CONDITIONAL,
    auditEvent: true
  })
]);

export const PERMISSION_CODES = Object.freeze(PERMISSIONS.map(({ code }) => code));

export const PERMISSION_BY_CODE = Object.freeze(
  Object.fromEntries(PERMISSIONS.map((permission) => [permission.code, permission]))
);
