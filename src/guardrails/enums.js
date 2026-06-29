export const ElectionState = Object.freeze({
  DRAFT: "draft",
  READY_FOR_REVIEW: "ready_for_review",
  APPROVED: "approved",
  SCHEDULED: "scheduled",
  NOTICE: "notice",
  OPEN: "open",
  PAUSED: "paused",
  CLOSED: "closed",
  TALLYING: "tallying",
  PENDING_CONFIRMATION: "pending_confirmation",
  CONFIRMED: "confirmed",
  PUBLISHED: "published",
  ARCHIVED: "archived",
  INVALIDATED: "invalidated"
});

export const AuthenticationMethod = Object.freeze({
  INVITE_LINK_ONLY: "invite_link_only",
  INVITE_LINK_WITH_IDENTIFIER: "invite_link_with_identifier",
  EMAIL_CODE: "email_code",
  SMS_CODE: "sms_code",
  KAKAO_MESSAGE: "kakao_message",
  EXTERNAL_IDENTITY: "external_identity",
  SSO: "sso",
  LEGAL_STRONG_AUTH: "legal_strong_auth"
});

export const DEFAULT_AUTHENTICATION_METHOD =
  AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER;

export const CODE_AUTHENTICATION_METHODS = Object.freeze([
  AuthenticationMethod.EMAIL_CODE,
  AuthenticationMethod.SMS_CODE,
  AuthenticationMethod.KAKAO_MESSAGE
]);

export const VotingMode = Object.freeze({
  ANONYMOUS: "anonymous",
  NAMED: "named"
});

export const BallotSubmissionStatus = Object.freeze({
  RECEIVED: "received",
  FAILED: "failed",
  UNCERTAIN: "uncertain"
});

export const BallotAcceptanceStatus = Object.freeze({
  ACCEPTED: "accepted",
  REJECTED_LATE: "rejected_late",
  REJECTED_INVALID: "rejected_invalid",
  SUPERSEDED: "superseded"
});

export const ResultStatus = Object.freeze({
  DRAFT: "draft",
  TALLIED: "tallied",
  DISCARDED: "discarded"
});

export const ResultVersionStatus = Object.freeze({
  CONFIRMED: "confirmed",
  PUBLISHED: "published",
  SUPERSEDED: "superseded"
});

export const ResultVersionType = Object.freeze({
  INITIAL: "initial",
  CORRECTION: "correction",
  WITHDRAWAL: "withdrawal",
  INVALIDATION_NOTICE: "invalidation_notice"
});

export const AuditEventType = Object.freeze({
  ELECTION_CREATED: "election.created",
  ELECTION_UPDATED: "election.updated",
  ELECTION_REVIEW_REQUESTED: "election.review_requested",
  ELECTION_APPROVED: "election.approved",
  ELECTION_REJECTED: "election.rejected",
  ELECTION_OPENED: "election.opened",
  ELECTION_PAUSED: "election.paused",
  ELECTION_RESUMED: "election.resumed",
  ELECTION_CLOSED: "election.closed",
  ELECTION_INVALIDATED: "election.invalidated",
  AUTHENTICATION_POLICY_UPDATED: "authentication_policy.updated",
  VOTER_REGISTRY_IMPORTED: "voter_registry.imported",
  VOTER_REGISTRY_CONFIRMED: "voter_registry.confirmed",
  INVITATION_SENT: "invitation.sent",
  ROLE_CHANGED: "role.changed",
  RESULT_TALLY_STARTED: "result.tally_started",
  RESULT_TALLIED: "result.tallied",
  RESULT_CONFIRMED: "result.confirmed",
  RESULT_PUBLISHED: "result.published",
  CORRECTION_REQUESTED: "correction.requested",
  CORRECTION_APPROVED: "correction.approved",
  REPORT_EXPORT_REQUESTED: "report.export_requested",
  REPORT_EXPORT_DOWNLOADED: "report.export_downloaded",
  LOG_VIEWED: "log.viewed",
  LOG_EXPORT_REQUESTED: "log.export_requested",
  LOG_EXPORT_DOWNLOADED: "log.export_downloaded",
  DELETION_REQUESTED: "deletion.requested",
  DELETION_APPROVED: "deletion.approved",
  DB_ACCESS_REQUESTED: "db_access.requested",
  DB_ACCESS_APPROVED: "db_access.approved"
});

export const SecurityEventType = Object.freeze({
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  MFA_SUCCESS: "mfa_success",
  MFA_FAILED: "mfa_failed",
  STEP_UP_SUCCESS: "step_up_success",
  STEP_UP_FAILED: "step_up_failed",
  PERMISSION_DENIED: "permission_denied",
  SUSPICIOUS_ACCESS: "suspicious_access",
  ACCOUNT_LOCKED: "account_locked"
});

export const CredentialEventType = Object.freeze({
  INVITE_TOKEN_VERIFIED: "invite_token_verified",
  INVITE_TOKEN_FAILED: "invite_token_failed",
  INVITE_OPENED: "invite_opened",
  IDENTIFIER_CHECK_SUCCESS: "identifier_check_success",
  IDENTIFIER_CHECK_FAILED: "identifier_check_failed",
  CODE_SENT: "code_sent",
  CODE_RESENT: "code_resent",
  CODE_VERIFIED: "code_verified",
  CODE_FAILED: "code_failed",
  EXTERNAL_AUTH_SUCCESS: "external_auth_success",
  EXTERNAL_AUTH_FAILED: "external_auth_failed",
  LOCKED: "locked",
  UNLOCKED: "unlocked"
});

export const SubmissionEventType = Object.freeze({
  SUBMISSION_STARTED: "submission_started",
  SUBMISSION_ACCEPTED: "submission_accepted",
  SUBMISSION_FAILED: "submission_failed",
  SUBMISSION_UNCERTAIN: "submission_uncertain",
  LATE_REJECTED: "late_rejected",
  SUPERSEDED: "superseded"
});
