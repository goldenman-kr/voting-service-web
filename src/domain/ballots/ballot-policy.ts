import {
  BallotAcceptanceStatus,
  OFFICIAL_TALLY_BALLOT_CRITERIA
} from "../../guardrails/index.js";

export type ElectionPeriod = Readonly<{
  endsAt: Date | string;
}>;

export type BallotLike = Readonly<{
  id?: string;
  isCurrent: boolean;
  acceptanceStatus: string;
  serverReceivedAt: Date | string;
}>;

export type CurrentBallotPolicy = Readonly<{
  previousBallotUpdate: null | {
    id?: string;
    isCurrent: false;
    acceptanceStatus: typeof BallotAcceptanceStatus.SUPERSEDED;
  };
  newBallotUpdate: {
    id?: string;
    isCurrent: true;
  };
  mutateExistingBallot: false;
}>;

function toTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function isBallotAccepted(ballot: BallotLike): boolean {
  return ballot.acceptanceStatus === BallotAcceptanceStatus.ACCEPTED;
}

export function isBallotWithinElectionPeriod(
  ballot: Pick<BallotLike, "serverReceivedAt">,
  election: ElectionPeriod
): boolean {
  return toTime(ballot.serverReceivedAt) <= toTime(election.endsAt);
}

export function isBallotEligibleForTally(
  ballot: BallotLike,
  election: ElectionPeriod
): boolean {
  return (
    ballot.isCurrent === OFFICIAL_TALLY_BALLOT_CRITERIA.is_current &&
    ballot.acceptanceStatus === OFFICIAL_TALLY_BALLOT_CRITERIA.acceptance_status &&
    isBallotWithinElectionPeriod(ballot, election)
  );
}

export function getTallyEligibleBallots<T extends BallotLike>(
  ballots: readonly T[],
  election: ElectionPeriod
): T[] {
  return ballots.filter((ballot) => isBallotEligibleForTally(ballot, election));
}

export function markNewBallotAsCurrentPolicy(
  previousBallot: Pick<BallotLike, "id"> | null,
  newBallot: Pick<BallotLike, "id">
): CurrentBallotPolicy {
  return Object.freeze({
    previousBallotUpdate: previousBallot
      ? Object.freeze({
          id: previousBallot.id,
          isCurrent: false,
          acceptanceStatus: BallotAcceptanceStatus.SUPERSEDED
        })
      : null,
    newBallotUpdate: Object.freeze({
      id: newBallot.id,
      isCurrent: true
    }),
    mutateExistingBallot: false
  });
}
