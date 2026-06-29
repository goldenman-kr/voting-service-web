import { Role } from "./role-mapping.js";

export const Exposure = Object.freeze({
  ALLOWED: "allowed",
  MASKED: "masked",
  AGGREGATE: "aggregate",
  SELF_ONLY: "self_only",
  RESTRICTED: "restricted",
  FORBIDDEN: "forbidden"
});

export const SensitiveField = Object.freeze({
  VOTER_NAME: "voter_name",
  VOTER_EMAIL_PHONE: "voter_email_phone",
  EXTERNAL_IDENTIFIER: "external_identifier",
  PARTICIPATION_STATUS: "participation_status",
  LAST_SUBMITTED_AT: "last_submitted_at",
  DETAILED_SUBMITTED_AT: "detailed_submitted_at",
  BALLOT_ID: "ballot_id",
  VOTE_ID: "vote_id",
  ANONYMOUS_BALLOT_GROUP_ID: "anonymous_ballot_group_id",
  BALLOT_GROUP_TOKEN_HASH: "ballot_group_token_hash",
  RECEIPT_PREVIEW: "receipt_preview",
  IP: "ip",
  USER_AGENT: "user_agent",
  CREDENTIAL_EVENT_DETAIL: "credential_event_detail",
  SUBMISSION_EVENT_DETAIL: "submission_event_detail",
  RESULT_DETAIL: "result_detail",
  REPORT_DOWNLOAD_LINK: "report_download_link",
  AUDIT_EVENT_DETAIL: "audit_event_detail",
  SECURITY_EVENT_DETAIL: "security_event_detail"
});

const allRoles = Object.values(Role);

const forbiddenForAll = (...fields) =>
  Object.freeze(Object.fromEntries(fields.map((field) => [field, Exposure.FORBIDDEN])));

export const GLOBAL_FORBIDDEN_FIELDS = Object.freeze({
  ...forbiddenForAll(
    SensitiveField.BALLOT_ID,
    SensitiveField.VOTE_ID,
    SensitiveField.ANONYMOUS_BALLOT_GROUP_ID,
    SensitiveField.BALLOT_GROUP_TOKEN_HASH
  )
});

export const FIELD_EXPOSURE_BY_ROLE = Object.freeze({
  [Role.ELECTION_MANAGER]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.MASKED,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.MASKED,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.MASKED,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.AGGREGATE,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.AGGREGATE,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.IP]: Exposure.FORBIDDEN,
    [SensitiveField.USER_AGENT]: Exposure.FORBIDDEN,
    [SensitiveField.CREDENTIAL_EVENT_DETAIL]: Exposure.AGGREGATE,
    [SensitiveField.SUBMISSION_EVENT_DETAIL]: Exposure.AGGREGATE,
    [SensitiveField.RESULT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.REPORT_DOWNLOAD_LINK]: Exposure.FORBIDDEN,
    [SensitiveField.AUDIT_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.SECURITY_EVENT_DETAIL]: Exposure.FORBIDDEN
  }),
  [Role.ELECTION_APPROVER]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.MASKED,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.FORBIDDEN,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.MASKED,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.AGGREGATE,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.AGGREGATE,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.IP]: Exposure.FORBIDDEN,
    [SensitiveField.USER_AGENT]: Exposure.FORBIDDEN,
    [SensitiveField.CREDENTIAL_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.SUBMISSION_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.RESULT_DETAIL]: Exposure.ALLOWED,
    [SensitiveField.REPORT_DOWNLOAD_LINK]: Exposure.FORBIDDEN,
    [SensitiveField.AUDIT_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.SECURITY_EVENT_DETAIL]: Exposure.FORBIDDEN
  }),
  [Role.AUDITOR]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.MASKED,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.MASKED,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.MASKED,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.AGGREGATE,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.RESTRICTED,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.RESTRICTED,
    [SensitiveField.IP]: Exposure.MASKED,
    [SensitiveField.USER_AGENT]: Exposure.RESTRICTED,
    [SensitiveField.CREDENTIAL_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.SUBMISSION_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.RESULT_DETAIL]: Exposure.ALLOWED,
    [SensitiveField.REPORT_DOWNLOAD_LINK]: Exposure.RESTRICTED,
    [SensitiveField.AUDIT_EVENT_DETAIL]: Exposure.ALLOWED,
    [SensitiveField.SECURITY_EVENT_DETAIL]: Exposure.RESTRICTED
  }),
  [Role.RESULT_PUBLISHER]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.FORBIDDEN,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.FORBIDDEN,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.FORBIDDEN,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.AGGREGATE,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.IP]: Exposure.FORBIDDEN,
    [SensitiveField.USER_AGENT]: Exposure.FORBIDDEN,
    [SensitiveField.CREDENTIAL_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.SUBMISSION_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.RESULT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.REPORT_DOWNLOAD_LINK]: Exposure.RESTRICTED,
    [SensitiveField.AUDIT_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.SECURITY_EVENT_DETAIL]: Exposure.FORBIDDEN
  }),
  [Role.ORGANIZATION_OWNER]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.MASKED,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.MASKED,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.MASKED,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.AGGREGATE,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.AGGREGATE,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.IP]: Exposure.FORBIDDEN,
    [SensitiveField.USER_AGENT]: Exposure.FORBIDDEN,
    [SensitiveField.CREDENTIAL_EVENT_DETAIL]: Exposure.AGGREGATE,
    [SensitiveField.SUBMISSION_EVENT_DETAIL]: Exposure.AGGREGATE,
    [SensitiveField.RESULT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.REPORT_DOWNLOAD_LINK]: Exposure.RESTRICTED,
    [SensitiveField.AUDIT_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.SECURITY_EVENT_DETAIL]: Exposure.RESTRICTED
  }),
  [Role.SYSTEM_ADMIN]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.FORBIDDEN,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.FORBIDDEN,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.FORBIDDEN,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.AGGREGATE,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.IP]: Exposure.MASKED,
    [SensitiveField.USER_AGENT]: Exposure.RESTRICTED,
    [SensitiveField.CREDENTIAL_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.SUBMISSION_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.RESULT_DETAIL]: Exposure.AGGREGATE,
    [SensitiveField.REPORT_DOWNLOAD_LINK]: Exposure.RESTRICTED,
    [SensitiveField.AUDIT_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.SECURITY_EVENT_DETAIL]: Exposure.ALLOWED
  }),
  [Role.PRIVACY_ADMIN]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.MASKED,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.MASKED,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.MASKED,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.AGGREGATE,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.IP]: Exposure.FORBIDDEN,
    [SensitiveField.USER_AGENT]: Exposure.FORBIDDEN,
    [SensitiveField.CREDENTIAL_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.SUBMISSION_EVENT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.RESULT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.REPORT_DOWNLOAD_LINK]: Exposure.FORBIDDEN,
    [SensitiveField.AUDIT_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.SECURITY_EVENT_DETAIL]: Exposure.FORBIDDEN
  }),
  [Role.SECURITY_ADMIN]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.FORBIDDEN,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.FORBIDDEN,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.FORBIDDEN,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.AGGREGATE,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.FORBIDDEN,
    [SensitiveField.IP]: Exposure.MASKED,
    [SensitiveField.USER_AGENT]: Exposure.RESTRICTED,
    [SensitiveField.CREDENTIAL_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.SUBMISSION_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.RESULT_DETAIL]: Exposure.FORBIDDEN,
    [SensitiveField.REPORT_DOWNLOAD_LINK]: Exposure.RESTRICTED,
    [SensitiveField.AUDIT_EVENT_DETAIL]: Exposure.RESTRICTED,
    [SensitiveField.SECURITY_EVENT_DETAIL]: Exposure.ALLOWED
  }),
  [Role.VOTER]: Object.freeze({
    [SensitiveField.VOTER_NAME]: Exposure.SELF_ONLY,
    [SensitiveField.VOTER_EMAIL_PHONE]: Exposure.SELF_ONLY,
    [SensitiveField.EXTERNAL_IDENTIFIER]: Exposure.SELF_ONLY,
    [SensitiveField.PARTICIPATION_STATUS]: Exposure.SELF_ONLY,
    [SensitiveField.LAST_SUBMITTED_AT]: Exposure.SELF_ONLY,
    [SensitiveField.DETAILED_SUBMITTED_AT]: Exposure.SELF_ONLY,
    [SensitiveField.RECEIPT_PREVIEW]: Exposure.SELF_ONLY,
    [SensitiveField.RESULT_DETAIL]: Exposure.RESTRICTED
  }),
  [Role.PUBLIC_VIEWER]: Object.freeze({
    [SensitiveField.RESULT_DETAIL]: Exposure.RESTRICTED
  })
});

for (const role of allRoles) {
  FIELD_EXPOSURE_BY_ROLE[role] ?? Object.freeze({});
}

export function getFieldExposure(role, field) {
  if (GLOBAL_FORBIDDEN_FIELDS[field]) {
    return GLOBAL_FORBIDDEN_FIELDS[field];
  }
  return FIELD_EXPOSURE_BY_ROLE[role]?.[field] ?? Exposure.FORBIDDEN;
}

export function isFieldAllowed(role, field) {
  return getFieldExposure(role, field) !== Exposure.FORBIDDEN;
}
