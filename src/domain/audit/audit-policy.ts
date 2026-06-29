import { ControlRequirement, PERMISSION_BY_CODE } from "../../guardrails/index.js";
import { ElectionAction } from "../elections/actions";

const actionPermissionCode: Readonly<Partial<Record<ElectionAction, string>>> = Object.freeze({
  [ElectionAction.EDIT_ELECTION_INFO]: "election.update",
  [ElectionAction.EDIT_QUESTIONS]: "question.write",
  [ElectionAction.EDIT_OPTIONS]: "question.write",
  [ElectionAction.EDIT_VOTER_REGISTRY]: "voter_registry.import",
  [ElectionAction.SEND_INVITATIONS]: "invitation.send",
  [ElectionAction.PAUSE_ELECTION]: "election.pause",
  [ElectionAction.RESUME_ELECTION]: "election.resume",
  [ElectionAction.CLOSE_ELECTION]: "election.close",
  [ElectionAction.TALLY_RESULT]: "result.tally",
  [ElectionAction.CONFIRM_RESULT]: "result.confirm",
  [ElectionAction.PUBLISH_RESULT]: "result.publish",
  [ElectionAction.REQUEST_CORRECTION]: "result.correct.request",
  [ElectionAction.INVALIDATE_ELECTION]: "election.invalidate",
  [ElectionAction.EXPORT_REPORT]: "report.export.request",
  [ElectionAction.VIEW_AUDIT_LOG]: "audit_event.read"
});

export function getPermissionCodeForAction(action: ElectionAction): string | undefined {
  return actionPermissionCode[action];
}

function permissionForAction(action: ElectionAction) {
  const code = getPermissionCodeForAction(action);
  return code ? PERMISSION_BY_CODE[code] : undefined;
}

function requirementIsEnabled(requirement: string | undefined): boolean {
  return requirement === ControlRequirement.YES || requirement === ControlRequirement.CONDITIONAL;
}

export function requiresAuditEvent(action: ElectionAction): boolean {
  return permissionForAction(action)?.auditEvent === true;
}

export function requiresReason(action: ElectionAction): boolean {
  return requirementIsEnabled(permissionForAction(action)?.reason);
}

export function requiresStepUp(action: ElectionAction): boolean {
  return requirementIsEnabled(permissionForAction(action)?.stepUp);
}

export function requiresDualApproval(action: ElectionAction): boolean {
  return requirementIsEnabled(permissionForAction(action)?.dualApproval);
}
