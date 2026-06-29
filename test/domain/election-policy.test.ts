import { describe, expect, it } from "vitest";

import { ElectionState } from "../../src/guardrails/index.js";
import { PolicyDecision } from "../../src/domain/policy-decision";
import {
  assertElectionTransitionAllowed,
  canInvalidateElectionFromState,
  canTransitionElectionState,
  getAllowedElectionTransitions
} from "../../src/domain/elections/state-machine";
import {
  ElectionAction,
  canPerformElectionAction,
  getAllowedElectionActions,
  getDeniedElectionActions
} from "../../src/domain/elections/actions";

describe("election state machine", () => {
  it("allows approved lifecycle transitions", () => {
    expect(canTransitionElectionState(ElectionState.DRAFT, ElectionState.READY_FOR_REVIEW)).toBe(true);
    expect(canTransitionElectionState(ElectionState.READY_FOR_REVIEW, ElectionState.DRAFT)).toBe(true);
    expect(canTransitionElectionState(ElectionState.READY_FOR_REVIEW, ElectionState.APPROVED)).toBe(true);
    expect(canTransitionElectionState(ElectionState.APPROVED, ElectionState.SCHEDULED)).toBe(true);
    expect(canTransitionElectionState(ElectionState.SCHEDULED, ElectionState.OPEN)).toBe(true);
    expect(canTransitionElectionState(ElectionState.NOTICE, ElectionState.OPEN)).toBe(true);
    expect(canTransitionElectionState(ElectionState.OPEN, ElectionState.PAUSED)).toBe(true);
    expect(canTransitionElectionState(ElectionState.PAUSED, ElectionState.OPEN)).toBe(true);
    expect(canTransitionElectionState(ElectionState.OPEN, ElectionState.CLOSED)).toBe(true);
    expect(canTransitionElectionState(ElectionState.CLOSED, ElectionState.TALLYING)).toBe(true);
    expect(canTransitionElectionState(ElectionState.TALLYING, ElectionState.PENDING_CONFIRMATION)).toBe(true);
    expect(canTransitionElectionState(ElectionState.PENDING_CONFIRMATION, ElectionState.CONFIRMED)).toBe(true);
    expect(canTransitionElectionState(ElectionState.CONFIRMED, ElectionState.PUBLISHED)).toBe(true);
  });

  it("blocks invalid direct transitions and throws on assert", () => {
    expect(canTransitionElectionState(ElectionState.DRAFT, ElectionState.OPEN)).toBe(false);
    expect(canTransitionElectionState(ElectionState.PUBLISHED, ElectionState.CONFIRMED)).toBe(false);
    expect(() =>
      assertElectionTransitionAllowed(ElectionState.PUBLISHED, ElectionState.CONFIRMED)
    ).toThrow(/not allowed/);
  });

  it("allows invalidation only from operational/result states", () => {
    expect(canInvalidateElectionFromState(ElectionState.DRAFT)).toBe(false);
    expect(canInvalidateElectionFromState(ElectionState.OPEN)).toBe(true);
    expect(canInvalidateElectionFromState(ElectionState.PUBLISHED)).toBe(true);
    expect(getAllowedElectionTransitions(ElectionState.INVALIDATED)).toEqual([]);
  });
});

describe("state-based election actions", () => {
  it("allows ballot submission only while open", () => {
    expect(canPerformElectionAction(ElectionState.OPEN, ElectionAction.SUBMIT_BALLOT)).toBe(
      PolicyDecision.ALLOWED
    );
    expect(canPerformElectionAction(ElectionState.PAUSED, ElectionAction.SUBMIT_BALLOT)).toBe(
      PolicyDecision.DENIED
    );
    expect(canPerformElectionAction(ElectionState.CLOSED, ElectionAction.SUBMIT_REVOTE)).toBe(
      PolicyDecision.DENIED
    );
  });

  it("requires stronger controls for risky admin actions", () => {
    expect(canPerformElectionAction(ElectionState.OPEN, ElectionAction.PAUSE_ELECTION)).toBe(
      PolicyDecision.REQUIRES_DUAL_APPROVAL
    );
    expect(canPerformElectionAction(ElectionState.PAUSED, ElectionAction.RESUME_ELECTION)).toBe(
      PolicyDecision.REQUIRES_STEP_UP
    );
    expect(canPerformElectionAction(ElectionState.PENDING_CONFIRMATION, ElectionAction.CONFIRM_RESULT)).toBe(
      PolicyDecision.REQUIRES_DUAL_APPROVAL
    );
  });

  it("keeps correction as a Published-only domain flow, not result overwrite", () => {
    expect(canPerformElectionAction(ElectionState.PUBLISHED, ElectionAction.REQUEST_CORRECTION)).toBe(
      PolicyDecision.REQUIRES_REASON
    );
    expect(canPerformElectionAction(ElectionState.CONFIRMED, ElectionAction.REQUEST_CORRECTION)).toBe(
      PolicyDecision.DENIED
    );
  });

  it("lists allowed and denied actions for a state", () => {
    expect(getAllowedElectionActions(ElectionState.DRAFT)).toContain(ElectionAction.EDIT_ELECTION_INFO);
    expect(getDeniedElectionActions(ElectionState.DRAFT)).toContain(ElectionAction.SUBMIT_BALLOT);
  });
});
