export const Role = Object.freeze({
  SYSTEM_ADMIN: "SystemAdmin",
  ORGANIZATION_OWNER: "OrganizationOwner",
  ELECTION_MANAGER: "ElectionManager",
  ELECTION_APPROVER: "ElectionApprover",
  AUDITOR: "Auditor",
  RESULT_PUBLISHER: "ResultPublisher",
  PRIVACY_ADMIN: "PrivacyAdmin",
  SECURITY_ADMIN: "SecurityAdmin",
  VOTER: "Voter",
  PUBLIC_VIEWER: "PublicViewer"
});

export const ROLE_PERMISSIONS = Object.freeze({
  [Role.SYSTEM_ADMIN]: Object.freeze([
    "tenant.read",
    "tenant.manage",
    "system.security.read",
    "db_access.request",
    "db_access.review",
    "security_event.read",
    "db_access_event.read"
  ]),
  [Role.ORGANIZATION_OWNER]: Object.freeze([
    "organization.read",
    "organization.update",
    "organization.security.update",
    "organization.auth_method.manage",
    "user.read",
    "user.invite",
    "user.update",
    "user.disable",
    "role.read",
    "role.assign",
    "permission.read",
    "retention.read",
    "retention.update",
    "audit_event.read"
  ]),
  [Role.ELECTION_MANAGER]: Object.freeze([
    "election.read",
    "election.create",
    "election.update",
    "election.delete_draft",
    "election.request_review",
    "question.read",
    "question.write",
    "auth_policy.read",
    "auth_policy.write",
    "voter_registry.read",
    "voter_registry.import",
    "voter_registry.validate",
    "eligible_voter.read",
    "invitation.read",
    "invitation.send",
    "invitation.resend",
    "participation.read",
    "credential.read",
    "incident.read",
    "incident.create"
  ]),
  [Role.ELECTION_APPROVER]: Object.freeze([
    "election.read",
    "election.approve",
    "election.reject",
    "election.schedule",
    "election.open",
    "election.pause",
    "election.resume",
    "election.close",
    "participation.read",
    "result.read",
    "incident.read",
    "incident.resolve"
  ]),
  [Role.AUDITOR]: Object.freeze([
    "election.read",
    "result.read",
    "report.create",
    "audit_event.read",
    "security_event.read",
    "credential_event.read",
    "submission_event.read",
    "db_access_event.read",
    "dispute.read",
    "invalidation.read"
  ]),
  [Role.RESULT_PUBLISHER]: Object.freeze([
    "election.read",
    "result.read",
    "result.publish",
    "report.create",
    "report.export.request",
    "report.export.download"
  ]),
  [Role.PRIVACY_ADMIN]: Object.freeze([
    "retention.read",
    "retention.update",
    "retention.delete.request",
    "retention.delete.approve",
    "eligible_voter.read",
    "audit_event.read"
  ]),
  [Role.SECURITY_ADMIN]: Object.freeze([
    "organization.security.update",
    "security_event.read",
    "audit_event.read",
    "db_access_event.read",
    "log.export.request",
    "log.export.approve",
    "log.export.download",
    "db_access.request",
    "db_access.approve",
    "db_access.review",
    "system.security.read"
  ]),
  [Role.VOTER]: Object.freeze([]),
  [Role.PUBLIC_VIEWER]: Object.freeze([])
});

export const EXPLICITLY_FORBIDDEN_ROLE_PERMISSIONS = Object.freeze({
  [Role.ELECTION_MANAGER]: Object.freeze([
    "election.approve",
    "result.confirm",
    "result.publish",
    "election.invalidate",
    "log.export.request",
    "log.export.approve",
    "log.export.download",
    "role.assign"
  ]),
  [Role.AUDITOR]: Object.freeze([
    "election.update",
    "election.open",
    "election.pause",
    "election.resume",
    "election.close",
    "result.confirm",
    "result.publish",
    "role.assign"
  ]),
  [Role.VOTER]: Object.freeze(["*admin*"]),
  [Role.PUBLIC_VIEWER]: Object.freeze(["*admin*"])
});
