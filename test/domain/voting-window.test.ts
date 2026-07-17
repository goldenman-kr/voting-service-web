import { describe, expect, it } from "vitest";

import {
  isAwaitingAdminResultProcessing,
  isVotingWindowOpen
} from "../../src/domain/elections/voting-window";
import { ElectionState } from "../../src/guardrails/index.js";

const endsAt = new Date("2026-07-18T00:00:00.000Z");

describe("voting window", () => {
  it("allows voting only while an open election is within its end time", () => {
    const election = { state: ElectionState.OPEN, endsAt };

    expect(isVotingWindowOpen(election, new Date("2026-07-17T23:59:59.999Z"))).toBe(true);
    expect(isVotingWindowOpen(election, endsAt)).toBe(true);
    expect(isVotingWindowOpen(election, new Date("2026-07-18T00:00:00.001Z"))).toBe(false);
  });

  it("marks an expired open election as awaiting admin result processing", () => {
    const afterEnd = new Date("2026-07-18T00:00:00.001Z");

    expect(isAwaitingAdminResultProcessing({ state: ElectionState.OPEN, endsAt }, afterEnd)).toBe(true);
    expect(isAwaitingAdminResultProcessing({ state: ElectionState.CLOSED, endsAt }, afterEnd)).toBe(false);
  });
});
