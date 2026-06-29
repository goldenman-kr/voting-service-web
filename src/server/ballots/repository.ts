import type { AuthenticationMethodValue } from "../../domain/auth-policy/authentication-policy";
import type { ElectionStateValue } from "../../domain/elections/state-machine";
import type { VoterSessionRecord } from "../voters/repository";

export type VotingModeValue = "anonymous" | "named";
export type QuestionTypeValue = "single_choice" | "multiple_choice" | "yes_no" | "free_text";
export type RecordStatusValue = "active" | "disabled" | "archived";
export type AnonymousVotingPassStatusValue = "issued" | "used" | "revoked" | "expired";
export type BallotSubmissionStatusValue = "received" | "failed" | "uncertain";
export type BallotAcceptanceStatusValue =
  | "accepted"
  | "rejected_late"
  | "rejected_invalid"
  | "superseded";
export type VoteAnswerTypeValue = "option" | "free_text" | "abstain";
export type SubmissionEventTypeValue =
  | "submission_started"
  | "submission_accepted"
  | "submission_failed"
  | "submission_uncertain"
  | "late_rejected"
  | "superseded";

export type VoterElectionRecord = Readonly<{
  id: string;
  title: string;
  description?: string | null;
  votingMode: VotingModeValue;
  state: ElectionStateValue;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
}>;

export type QuestionWithOptionsRecord = Readonly<{
  id: string;
  title: string;
  description?: string | null;
  questionType: QuestionTypeValue;
  required: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
  displayOrder: number;
  status: RecordStatusValue;
  options: readonly Readonly<{
    id: string;
    label: string;
    description?: string | null;
    displayOrder: number;
    status: RecordStatusValue;
  }>[];
}>;

export type VotingCredentialParticipationRecord = Readonly<{
  id: string;
  electionId: string;
  hasVoted: boolean;
  lastVoteConfirmedAt?: Date | null;
  submissionCount: number;
}>;

export type AnonymousVotingPassRecord = Readonly<{
  id: string;
  electionId: string;
  votingCredentialId: string;
  passStatus: AnonymousVotingPassStatusValue;
  usedAt?: Date | null;
  usageCount: number;
}>;

export type AnonymousBallotGroupRecord = Readonly<{
  id: string;
  electionId: string;
  ballotGroupTokenHash: string;
  currentBallotId?: string | null;
  submissionCount: number;
}>;

export type BallotRecord = Readonly<{
  id: string;
  electionId: string;
  anonymousBallotGroupId: string;
  submissionStatus: BallotSubmissionStatusValue;
  acceptanceStatus: BallotAcceptanceStatusValue;
  serverReceivedAt: Date;
  isCurrent: boolean;
  receiptHash: string;
}>;

export type VoteCreateInput = Readonly<{
  questionId: string;
  answerType: VoteAnswerTypeValue;
  freeTextEncrypted?: string;
  optionIds: readonly string[];
}>;

export type BallotSubmissionCommand = Readonly<{
  electionId: string;
  anonymousBallotGroupId: string;
  serverReceivedAt: Date;
  submissionStatus: BallotSubmissionStatusValue;
  acceptanceStatus: BallotAcceptanceStatusValue;
  isCurrent: boolean;
  receiptHash: string;
  votes: readonly VoteCreateInput[];
}>;

export type SubmissionEventInput = Readonly<{
  electionId: string;
  ballotId?: string;
  eventType: SubmissionEventTypeValue;
  serverReceivedAt?: Date;
  acceptanceStatus?: BallotAcceptanceStatusValue;
  reasonCode?: string;
  ipMasked?: string;
  ipHash?: string;
  userAgentSummary?: string;
}>;

export type SubmitBallotTransactionResult = Readonly<{
  ballot: BallotRecord;
  supersededBallotIds: readonly string[];
  currentBallotCount: number;
}>;

export type BallotRepository = {
  findVoterSessionByHandleHash(handleHash: string, now?: Date): Promise<VoterSessionRecord | null>;
  touchVoterSession(handleHash: string, touchedAt?: Date): Promise<void>;
  findElectionById(electionId: string): Promise<VoterElectionRecord | null>;
  listQuestionsWithOptions(electionId: string): Promise<QuestionWithOptionsRecord[]>;
  findVotingCredential(id: string): Promise<VotingCredentialParticipationRecord | null>;
  updateVotingCredentialParticipation(input: {
    votingCredentialId: string;
    hasVoted: boolean;
    lastVoteConfirmedAt?: Date;
    incrementSubmissionCount?: boolean;
  }): Promise<void>;
  findAnonymousVotingPassByCredential(
    electionId: string,
    votingCredentialId: string
  ): Promise<AnonymousVotingPassRecord | null>;
  createAnonymousVotingPass(input: {
    electionId: string;
    votingCredentialId: string;
  }): Promise<AnonymousVotingPassRecord>;
  markAnonymousVotingPassUsed(input: {
    passId: string;
    usedAt: Date;
  }): Promise<AnonymousVotingPassRecord>;
  findAnonymousBallotGroupByTokenHash(
    electionId: string,
    tokenHash: string
  ): Promise<AnonymousBallotGroupRecord | null>;
  createAnonymousBallotGroup(input: {
    electionId: string;
    tokenHash: string;
  }): Promise<AnonymousBallotGroupRecord>;
  submitBallotTransaction(input: {
    ballot: BallotSubmissionCommand;
    submissionEvents: readonly SubmissionEventInput[];
    accepted: boolean;
    votingCredentialId: string;
    anonymousPassId: string;
  }): Promise<SubmitBallotTransactionResult>;
  recordSubmissionEvent(input: SubmissionEventInput): Promise<void>;
};
