import { ElectionState } from "../../guardrails/index.js";

export type VotingWindowElection = Readonly<{
  state: string;
  endsAt: Date;
}>;

export function isVotingWindowOpen(
  election: VotingWindowElection,
  now = new Date()
): boolean {
  return election.state === ElectionState.OPEN && now.getTime() <= election.endsAt.getTime();
}

export function isAwaitingAdminResultProcessing(
  election: VotingWindowElection,
  now = new Date()
): boolean {
  return election.state === ElectionState.OPEN && now.getTime() > election.endsAt.getTime();
}
