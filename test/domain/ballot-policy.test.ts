import { describe, expect, it } from "vitest";

import { BallotAcceptanceStatus } from "../../src/guardrails/index.js";
import {
  getTallyEligibleBallots,
  isBallotAccepted,
  isBallotEligibleForTally,
  isBallotWithinElectionPeriod,
  markNewBallotAsCurrentPolicy
} from "../../src/domain/ballots/ballot-policy";

const election = { endsAt: "2026-01-01T10:00:00.000Z" };

describe("Ballot tally policy", () => {
  it("uses serverReceivedAt as the election period boundary", () => {
    expect(
      isBallotWithinElectionPeriod(
        { serverReceivedAt: "2026-01-01T10:00:00.000Z" },
        election
      )
    ).toBe(true);
    expect(
      isBallotWithinElectionPeriod(
        { serverReceivedAt: "2026-01-01T10:00:00.001Z" },
        election
      )
    ).toBe(false);
  });

  it("accepts only accepted ballots", () => {
    expect(
      isBallotAccepted({
        isCurrent: true,
        acceptanceStatus: BallotAcceptanceStatus.ACCEPTED,
        serverReceivedAt: election.endsAt
      })
    ).toBe(true);
    expect(
      isBallotAccepted({
        isCurrent: true,
        acceptanceStatus: BallotAcceptanceStatus.REJECTED_LATE,
        serverReceivedAt: election.endsAt
      })
    ).toBe(false);
  });

  it("marks only current accepted in-period ballots as tally eligible", () => {
    const ballots = [
      {
        id: "current",
        isCurrent: true,
        acceptanceStatus: BallotAcceptanceStatus.ACCEPTED,
        serverReceivedAt: "2026-01-01T09:59:59.999Z"
      },
      {
        id: "old",
        isCurrent: false,
        acceptanceStatus: BallotAcceptanceStatus.ACCEPTED,
        serverReceivedAt: "2026-01-01T09:59:59.999Z"
      },
      {
        id: "late",
        isCurrent: true,
        acceptanceStatus: BallotAcceptanceStatus.ACCEPTED,
        serverReceivedAt: "2026-01-01T10:00:00.001Z"
      }
    ];

    expect(isBallotEligibleForTally(ballots[0], election)).toBe(true);
    expect(getTallyEligibleBallots(ballots, election).map((ballot) => ballot.id)).toEqual([
      "current"
    ]);
  });
});

describe("revote policy", () => {
  it("describes a new-current policy without mutating existing ballots", () => {
    const policy = markNewBallotAsCurrentPolicy({ id: "previous" }, { id: "new" });
    expect(policy.mutateExistingBallot).toBe(false);
    expect(policy.previousBallotUpdate).toEqual({
      id: "previous",
      isCurrent: false,
      acceptanceStatus: BallotAcceptanceStatus.SUPERSEDED
    });
    expect(policy.newBallotUpdate).toEqual({ id: "new", isCurrent: true });
  });
});
