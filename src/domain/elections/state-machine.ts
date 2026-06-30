import { ElectionState } from "../../guardrails/index.js";

export type ElectionStateValue = (typeof ElectionState)[keyof typeof ElectionState];

export const ALLOWED_ELECTION_TRANSITIONS: Readonly<Record<ElectionStateValue, readonly ElectionStateValue[]>> =
  Object.freeze({
    [ElectionState.DRAFT]: Object.freeze([
      ElectionState.READY_FOR_REVIEW,
      ElectionState.OPEN
    ]),
    [ElectionState.READY_FOR_REVIEW]: Object.freeze([
      ElectionState.DRAFT,
      ElectionState.APPROVED,
      ElectionState.OPEN
    ]),
    [ElectionState.APPROVED]: Object.freeze([ElectionState.SCHEDULED, ElectionState.OPEN]),
    [ElectionState.SCHEDULED]: Object.freeze([ElectionState.NOTICE, ElectionState.OPEN]),
    [ElectionState.NOTICE]: Object.freeze([ElectionState.OPEN]),
    [ElectionState.OPEN]: Object.freeze([
      ElectionState.PAUSED,
      ElectionState.CLOSED,
      ElectionState.INVALIDATED
    ]),
    [ElectionState.PAUSED]: Object.freeze([
      ElectionState.OPEN,
      ElectionState.CLOSED,
      ElectionState.INVALIDATED
    ]),
    [ElectionState.CLOSED]: Object.freeze([
      ElectionState.TALLYING,
      ElectionState.INVALIDATED
    ]),
    [ElectionState.TALLYING]: Object.freeze([
      ElectionState.PENDING_CONFIRMATION,
      ElectionState.INVALIDATED
    ]),
    [ElectionState.PENDING_CONFIRMATION]: Object.freeze([
      ElectionState.CONFIRMED,
      ElectionState.INVALIDATED
    ]),
    [ElectionState.CONFIRMED]: Object.freeze([
      ElectionState.PUBLISHED,
      ElectionState.INVALIDATED
    ]),
    [ElectionState.PUBLISHED]: Object.freeze([ElectionState.INVALIDATED]),
    [ElectionState.ARCHIVED]: Object.freeze([]),
    [ElectionState.INVALIDATED]: Object.freeze([])
  });

export function getAllowedElectionTransitions(
  state: ElectionStateValue
): readonly ElectionStateValue[] {
  return ALLOWED_ELECTION_TRANSITIONS[state] ?? [];
}

export function canTransitionElectionState(
  from: ElectionStateValue,
  to: ElectionStateValue
): boolean {
  return getAllowedElectionTransitions(from).includes(to);
}

export function assertElectionTransitionAllowed(
  from: ElectionStateValue,
  to: ElectionStateValue
): void {
  if (!canTransitionElectionState(from, to)) {
    throw new Error(`Election state transition is not allowed: ${from} -> ${to}`);
  }
}

export function canInvalidateElectionFromState(state: ElectionStateValue): boolean {
  return getAllowedElectionTransitions(state).includes(ElectionState.INVALIDATED);
}
