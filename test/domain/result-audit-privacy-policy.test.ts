import { describe, expect, it } from "vitest";

import { ElectionState, Role, SensitiveField } from "../../src/guardrails/index.js";
import {
  assertPublishedResultNotOverwritten,
  canOverwritePublishedResult,
  canPublishResultVersion,
  reportMustReferenceResultVersion,
  requiresCorrectionRequestForPublishedChange,
  requiresInvalidationRecord
} from "../../src/domain/results/result-policy";
import {
  requiresAuditEvent,
  requiresDualApproval,
  requiresReason,
  requiresStepUp
} from "../../src/domain/audit/audit-policy";
import { ElectionAction } from "../../src/domain/elections/actions";
import {
  isAnonymousVotingForbiddenField,
  isFieldForbiddenForRole,
  sanitizeResponseForRole
} from "../../src/server/privacy/field-exposure";

describe("Published result policy", () => {
  it("publishes only confirmed result versions and never overwrites published results", () => {
    expect(canPublishResultVersion(ElectionState.CONFIRMED)).toBe(true);
    expect(canPublishResultVersion(ElectionState.PUBLISHED)).toBe(false);
    expect(canOverwritePublishedResult()).toBe(false);
    expect(() => assertPublishedResultNotOverwritten("overwrite")).toThrow(/must not be overwritten/);
    expect(() => assertPublishedResultNotOverwritten("correction")).not.toThrow();
  });

  it("requires correction or invalidation records for published changes", () => {
    expect(requiresCorrectionRequestForPublishedChange(ElectionState.PUBLISHED)).toBe(true);
    expect(requiresCorrectionRequestForPublishedChange(ElectionState.CONFIRMED)).toBe(false);
    expect(requiresInvalidationRecord(ElectionState.PUBLISHED)).toBe(true);
    expect(reportMustReferenceResultVersion("rv-1")).toBe(true);
    expect(reportMustReferenceResultVersion(null)).toBe(false);
  });
});

describe("Audit requirement policy", () => {
  it("derives risk controls from permission guardrails", () => {
    expect(requiresAuditEvent(ElectionAction.PUBLISH_RESULT)).toBe(true);
    expect(requiresReason(ElectionAction.PUBLISH_RESULT)).toBe(true);
    expect(requiresStepUp(ElectionAction.PUBLISH_RESULT)).toBe(true);
    expect(requiresDualApproval(ElectionAction.INVALIDATE_ELECTION)).toBe(true);
  });

  it("does not force AuditEvent for voter ballot submission helper", () => {
    expect(requiresAuditEvent(ElectionAction.SUBMIT_BALLOT)).toBe(false);
  });
});

describe("field exposure policy", () => {
  it("detects role-forbidden fields", () => {
    expect(isFieldForbiddenForRole(Role.ELECTION_MANAGER, SensitiveField.IP)).toBe(true);
    expect(isFieldForbiddenForRole(Role.AUDITOR, SensitiveField.AUDIT_EVENT_DETAIL)).toBe(false);
  });

  it("detects anonymous voting forbidden fields", () => {
    expect(isAnonymousVotingForbiddenField("ballotId")).toBe(true);
    expect(isAnonymousVotingForbiddenField("anonymousBallotGroupId")).toBe(true);
    expect(isAnonymousVotingForbiddenField("ballot_group_token_hash")).toBe(true);
    expect(isAnonymousVotingForbiddenField("title")).toBe(false);
  });

  it("removes dangerous fields from anonymous responses", () => {
    const sanitized = sanitizeResponseForRole(
      Role.ELECTION_MANAGER,
      {
        title: "Election",
        ballotId: "ballot-1",
        anonymousBallotGroupId: "group-1",
        [SensitiveField.IP]: "192.0.2.1",
        [SensitiveField.PARTICIPATION_STATUS]: "aggregate"
      },
      { anonymousVoting: true }
    );

    expect(sanitized).toEqual({
      title: "Election",
      [SensitiveField.PARTICIPATION_STATUS]: "aggregate"
    });
  });
});
