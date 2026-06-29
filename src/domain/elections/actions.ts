import { ElectionState } from "../../guardrails/index.js";
import { PolicyDecision } from "../policy-decision";
import type { ElectionStateValue } from "./state-machine";

export const ElectionAction = {
  EDIT_ELECTION_INFO: "editElectionInfo",
  EDIT_QUESTIONS: "editQuestions",
  EDIT_OPTIONS: "editOptions",
  EDIT_VOTER_REGISTRY: "editVoterRegistry",
  SEND_INVITATIONS: "sendInvitations",
  SUBMIT_BALLOT: "submitBallot",
  SUBMIT_REVOTE: "submitRevote",
  PAUSE_ELECTION: "pauseElection",
  RESUME_ELECTION: "resumeElection",
  CLOSE_ELECTION: "closeElection",
  TALLY_RESULT: "tallyResult",
  CONFIRM_RESULT: "confirmResult",
  PUBLISH_RESULT: "publishResult",
  REQUEST_CORRECTION: "requestCorrection",
  INVALIDATE_ELECTION: "invalidateElection",
  EXPORT_REPORT: "exportReport",
  VIEW_AUDIT_LOG: "viewAuditLog"
} as const;

export type ElectionAction = (typeof ElectionAction)[keyof typeof ElectionAction];

export const ELECTION_ACTION_POLICY: Readonly<
  Record<ElectionAction, Readonly<Partial<Record<ElectionStateValue, PolicyDecision>>>>
> = Object.freeze({
  [ElectionAction.EDIT_ELECTION_INFO]: Object.freeze({
    [ElectionState.DRAFT]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.READY_FOR_REVIEW]: PolicyDecision.REQUIRES_REASON
  }),
  [ElectionAction.EDIT_QUESTIONS]: Object.freeze({
    [ElectionState.DRAFT]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.READY_FOR_REVIEW]: PolicyDecision.REQUIRES_REASON
  }),
  [ElectionAction.EDIT_OPTIONS]: Object.freeze({
    [ElectionState.DRAFT]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.READY_FOR_REVIEW]: PolicyDecision.REQUIRES_REASON
  }),
  [ElectionAction.EDIT_VOTER_REGISTRY]: Object.freeze({
    [ElectionState.DRAFT]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.READY_FOR_REVIEW]: PolicyDecision.REQUIRES_REASON
  }),
  [ElectionAction.SEND_INVITATIONS]: Object.freeze({
    [ElectionState.APPROVED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.SCHEDULED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.NOTICE]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.OPEN]: PolicyDecision.REQUIRES_REASON,
    [ElectionState.PAUSED]: PolicyDecision.REQUIRES_REASON
  }),
  [ElectionAction.SUBMIT_BALLOT]: Object.freeze({
    [ElectionState.OPEN]: PolicyDecision.ALLOWED
  }),
  [ElectionAction.SUBMIT_REVOTE]: Object.freeze({
    [ElectionState.OPEN]: PolicyDecision.ALLOWED
  }),
  [ElectionAction.PAUSE_ELECTION]: Object.freeze({
    [ElectionState.OPEN]: PolicyDecision.REQUIRES_DUAL_APPROVAL
  }),
  [ElectionAction.RESUME_ELECTION]: Object.freeze({
    [ElectionState.PAUSED]: PolicyDecision.REQUIRES_STEP_UP
  }),
  [ElectionAction.CLOSE_ELECTION]: Object.freeze({
    [ElectionState.OPEN]: PolicyDecision.REQUIRES_DUAL_APPROVAL,
    [ElectionState.PAUSED]: PolicyDecision.REQUIRES_DUAL_APPROVAL
  }),
  [ElectionAction.TALLY_RESULT]: Object.freeze({
    [ElectionState.CLOSED]: PolicyDecision.REQUIRES_STEP_UP
  }),
  [ElectionAction.CONFIRM_RESULT]: Object.freeze({
    [ElectionState.PENDING_CONFIRMATION]: PolicyDecision.REQUIRES_DUAL_APPROVAL
  }),
  [ElectionAction.PUBLISH_RESULT]: Object.freeze({
    [ElectionState.CONFIRMED]: PolicyDecision.REQUIRES_DUAL_APPROVAL
  }),
  [ElectionAction.REQUEST_CORRECTION]: Object.freeze({
    [ElectionState.PUBLISHED]: PolicyDecision.REQUIRES_REASON
  }),
  [ElectionAction.INVALIDATE_ELECTION]: Object.freeze({
    [ElectionState.OPEN]: PolicyDecision.REQUIRES_DUAL_APPROVAL,
    [ElectionState.PAUSED]: PolicyDecision.REQUIRES_DUAL_APPROVAL,
    [ElectionState.CLOSED]: PolicyDecision.REQUIRES_DUAL_APPROVAL,
    [ElectionState.TALLYING]: PolicyDecision.REQUIRES_DUAL_APPROVAL,
    [ElectionState.PENDING_CONFIRMATION]: PolicyDecision.REQUIRES_DUAL_APPROVAL,
    [ElectionState.CONFIRMED]: PolicyDecision.REQUIRES_DUAL_APPROVAL,
    [ElectionState.PUBLISHED]: PolicyDecision.REQUIRES_DUAL_APPROVAL
  }),
  [ElectionAction.EXPORT_REPORT]: Object.freeze({
    [ElectionState.CONFIRMED]: PolicyDecision.REQUIRES_REASON,
    [ElectionState.PUBLISHED]: PolicyDecision.REQUIRES_REASON,
    [ElectionState.ARCHIVED]: PolicyDecision.REQUIRES_REASON,
    [ElectionState.INVALIDATED]: PolicyDecision.REQUIRES_REASON
  }),
  [ElectionAction.VIEW_AUDIT_LOG]: Object.freeze({
    [ElectionState.DRAFT]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.READY_FOR_REVIEW]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.APPROVED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.SCHEDULED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.NOTICE]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.OPEN]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.PAUSED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.CLOSED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.TALLYING]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.PENDING_CONFIRMATION]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.CONFIRMED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.PUBLISHED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.ARCHIVED]: PolicyDecision.REQUIRES_PERMISSION,
    [ElectionState.INVALIDATED]: PolicyDecision.REQUIRES_PERMISSION
  })
});

export function canPerformElectionAction(
  state: ElectionStateValue,
  action: ElectionAction
): PolicyDecision {
  return ELECTION_ACTION_POLICY[action]?.[state] ?? PolicyDecision.DENIED;
}

export function getAllowedElectionActions(state: ElectionStateValue): ElectionAction[] {
  return Object.values(ElectionAction).filter(
    (action) => canPerformElectionAction(state, action) !== PolicyDecision.DENIED
  );
}

export function getDeniedElectionActions(state: ElectionStateValue): ElectionAction[] {
  return Object.values(ElectionAction).filter(
    (action) => canPerformElectionAction(state, action) === PolicyDecision.DENIED
  );
}
