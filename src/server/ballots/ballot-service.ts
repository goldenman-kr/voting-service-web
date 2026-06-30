import { createHmac, randomBytes } from "node:crypto";

import {
  isBallotEligibleForTally
} from "../../domain/ballots/ballot-policy";
import { ElectionAction, canPerformElectionAction } from "../../domain/elections/actions";
import { PolicyDecision } from "../../domain/policy-decision";
import { BallotAcceptanceStatus, ElectionState } from "../../guardrails/index.js";
import { hashIpAddress, maskIpAddress, summarizeUserAgent } from "../../lib/masking";
import { VOTER_SESSION_COOKIE_POLICY, hashOpaqueHandle } from "../auth/voter-session";
import { ApiError, createAuthenticationError } from "../http/errors";
import { sanitizeResponseForRole } from "../privacy/field-exposure";
import {
  BALLOT_GROUP_COOKIE_POLICY,
  assertBallotGroupTokenHashIsRandomTokenBased,
  createBallotGroupToken,
  hashBallotGroupToken
} from "./ballot-group-token";
import type {
  AnonymousBallotGroupRecord,
  AnonymousVotingPassRecord,
  BallotRepository,
  QuestionWithOptionsRecord,
  SubmissionEventInput,
  VoteCreateInput,
  VoterElectionRecord
} from "./repository";
import { submitBallotInputSchema, type BallotQuestionAnswerInput } from "./validation";

export type VoterRequestContext = Readonly<{
  voterSessionHandle?: string;
  ballotGroupToken?: string;
  hmacKey: string;
  now?: Date;
  ipAddress?: string;
  userAgent?: string;
}>;

export type BallotGroupCookieIssue = Readonly<{
  name: string;
  value: string;
  expires: Date;
}>;

export type SubmitBallotServiceResult = Readonly<{
  response: Readonly<{
    accepted: boolean;
    submitted_at: string;
    receipt_preview?: string;
    current_ballot_replaced: boolean;
    tally_eligible: boolean;
  }>;
  ballotGroupCookie?: BallotGroupCookieIssue;
}>;

function nowFrom(context: VoterRequestContext): Date {
  return context.now ?? new Date();
}

function badRequest(internalReason: string) {
  return new ApiError({
    status: 400,
    code: "bad_request",
    userMessage: "입력값을 확인해 주세요.",
    internalReason
  });
}

function forbiddenState(internalReason: string) {
  return new ApiError({
    status: 409,
    code: "conflict",
    userMessage: "현재 투표 상태에서는 이 작업을 수행할 수 없습니다.",
    internalReason
  });
}

function revoteDisabled(internalReason: string) {
  return new ApiError({
    status: 409,
    code: "conflict",
    userMessage: "이미 투표참여가 완료되어 다시 수정할 수 없습니다.",
    internalReason
  });
}

function protectFreeText(value: string, hmacKey: string): string {
  return `encrypted:${createHmac("sha256", hmacKey).update(value).digest("hex")}`;
}

function receiptHash(seed: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(seed).digest("hex");
}

function receiptPreview(hash: string): string {
  return hash.slice(0, 12);
}

function submissionContext(context: VoterRequestContext) {
  return {
    ipMasked: maskIpAddress(context.ipAddress),
    ipHash: hashIpAddress(context.ipAddress),
    userAgentSummary: summarizeUserAgent(context.userAgent)
  };
}

async function requireVoterSession(
  repository: BallotRepository,
  context: VoterRequestContext
) {
  if (!context.voterSessionHandle) {
    throw createAuthenticationError("missing voter session cookie");
  }
  const handleHash = hashOpaqueHandle(context.voterSessionHandle, context.hmacKey);
  const session = await repository.findVoterSessionByHandleHash(handleHash, nowFrom(context));
  if (!session || !session.authenticated) {
    throw createAuthenticationError("voter session missing expired revoked or unauthenticated");
  }
  return { session, handleHash };
}

async function requireElection(
  repository: BallotRepository,
  electionId: string
): Promise<VoterElectionRecord> {
  const election = await repository.findElectionById(electionId);
  if (!election) {
    throw createAuthenticationError("election not found for voter session");
  }
  return election;
}

function ensureSubmitAllowed(election: VoterElectionRecord): void {
  const decision = canPerformElectionAction(election.state, ElectionAction.SUBMIT_BALLOT);
  if (decision === PolicyDecision.DENIED) {
    throw forbiddenState(`submit denied in ${election.state}`);
  }
}

function voterStateMessage(election: VoterElectionRecord): string {
  if (election.state === ElectionState.OPEN) {
    return "투표가 진행 중입니다.";
  }
  if (election.state === ElectionState.PAUSED) {
    return "투표가 일시중단되었습니다.";
  }
  if (election.state === ElectionState.CLOSED) {
    return "투표가 마감되었습니다.";
  }
  if (election.state === ElectionState.INVALIDATED) {
    return "투표가 무효 처리되었습니다.";
  }
  return "아직 투표에 참여할 수 없습니다.";
}

function validateAnswers(
  questions: readonly QuestionWithOptionsRecord[],
  rawAnswers: readonly BallotQuestionAnswerInput[],
  hmacKey: string
): VoteCreateInput[] {
  const answerByQuestionId = new Map(rawAnswers.map((answer) => [answer.questionId, answer]));
  const votes: VoteCreateInput[] = [];

  for (const question of questions) {
    const answer = answerByQuestionId.get(question.id);
    if (!answer) {
      if (question.required) {
        throw badRequest(`required question missing: ${question.id}`);
      }
      continue;
    }
    const activeOptionIds = new Set(question.options.map((option) => option.id));
    const selectedOptionIds = answer.optionIds.filter((optionId) => activeOptionIds.has(optionId));
    if (selectedOptionIds.length !== answer.optionIds.length) {
      throw badRequest(`option does not belong to question: ${question.id}`);
    }
    if (answer.abstain) {
      votes.push({ questionId: question.id, answerType: "abstain", optionIds: [] });
      continue;
    }
    if (question.questionType === "free_text") {
      if (!answer.freeText && question.required) {
        throw badRequest(`required free text missing: ${question.id}`);
      }
      votes.push({
        questionId: question.id,
        answerType: "free_text",
        freeTextEncrypted: answer.freeText ? protectFreeText(answer.freeText, hmacKey) : undefined,
        optionIds: []
      });
      continue;
    }
    const minSelect = question.minSelect ?? (question.required ? 1 : 0);
    const maxSelect = question.maxSelect ?? (question.questionType === "multiple_choice" ? selectedOptionIds.length : 1);
    if (selectedOptionIds.length < minSelect || selectedOptionIds.length > maxSelect) {
      throw badRequest(`selection count out of range: ${question.id}`);
    }
    if (question.questionType !== "multiple_choice" && selectedOptionIds.length > 1) {
      throw badRequest(`single choice question has multiple options: ${question.id}`);
    }
    votes.push({
      questionId: question.id,
      answerType: "option",
      optionIds: selectedOptionIds
    });
  }

  const knownQuestionIds = new Set(questions.map((question) => question.id));
  for (const answer of rawAnswers) {
    if (!knownQuestionIds.has(answer.questionId)) {
      throw badRequest(`unknown question: ${answer.questionId}`);
    }
  }

  return votes;
}

async function getOrCreateAnonymousVotingPass(
  repository: BallotRepository,
  electionId: string,
  votingCredentialId: string
): Promise<AnonymousVotingPassRecord> {
  const existing = await repository.findAnonymousVotingPassByCredential(electionId, votingCredentialId);
  if (existing) {
    if (existing.passStatus === "revoked" || existing.passStatus === "expired") {
      throw createAuthenticationError("anonymous voting pass unavailable");
    }
    return existing;
  }
  return repository.createAnonymousVotingPass({ electionId, votingCredentialId });
}

async function getOrCreateAnonymousBallotGroup({
  repository,
  election,
  context
}: {
  repository: BallotRepository;
  election: VoterElectionRecord;
  context: VoterRequestContext;
}): Promise<{ group: AnonymousBallotGroupRecord; tokenToStore?: string }> {
  if (context.ballotGroupToken) {
    const tokenHash = hashBallotGroupToken(context.ballotGroupToken, context.hmacKey);
    const existing = await repository.findAnonymousBallotGroupByTokenHash(election.id, tokenHash);
    if (existing && existing.submissionCount === 0 && !existing.currentBallotId) {
      return { group: existing };
    }
  }

  const issued = createBallotGroupToken(context.hmacKey);
  const group = await repository.createAnonymousBallotGroup({
    electionId: election.id,
    tokenHash: issued.tokenHash
  });
  return { group, tokenToStore: issued.token };
}

export async function getVoterElectionInfo(
  repository: BallotRepository,
  context: VoterRequestContext
) {
  const { session, handleHash } = await requireVoterSession(repository, context);
  const [election, questions] = await Promise.all([
    requireElection(repository, session.electionId),
    repository.listQuestionsWithOptions(session.electionId)
  ]);
  await repository.touchVoterSession(handleHash, nowFrom(context));

  return sanitizeResponseForRole(
    "Voter",
    {
      election_id: election.id,
      title: election.title,
      description: election.description,
      state: election.state,
      state_message: voterStateMessage(election),
      voting_mode: election.votingMode,
      anonymous_notice:
        election.votingMode === "anonymous"
          ? "익명투표에서는 투표자 신원과 선택 내용이 분리되며, 이전 선택 내용은 다시 표시되지 않습니다."
          : undefined,
      starts_at: election.startsAt.toISOString(),
      ends_at: election.endsAt.toISOString(),
      questions: questions.map((question) => ({
        id: question.id,
        title: question.title,
        description: question.description,
        question_type: question.questionType,
        required: question.required,
        min_select: question.minSelect,
        max_select: question.maxSelect,
        display_order: question.displayOrder,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          display_order: option.displayOrder
        }))
      }))
    },
    { anonymousVoting: election.votingMode === "anonymous" }
  );
}

export async function getVoterCompletionStatus(
  repository: BallotRepository,
  context: VoterRequestContext
) {
  const { session, handleHash } = await requireVoterSession(repository, context);
  const credential = await repository.findVotingCredential(session.votingCredentialId);
  if (!credential) {
    throw createAuthenticationError("credential not found for voter session");
  }
  await repository.touchVoterSession(handleHash, nowFrom(context));

  return sanitizeResponseForRole(
    "Voter",
    {
      completed: credential.hasVoted,
      last_submitted_at: credential.lastVoteConfirmedAt?.toISOString(),
      submission_count: credential.submissionCount,
      receipt_preview: undefined
    },
    { anonymousVoting: true }
  );
}

export async function submitAnonymousBallot(
  repository: BallotRepository,
  rawInput: unknown,
  context: VoterRequestContext
): Promise<SubmitBallotServiceResult> {
  const parsed = (() => {
    try {
      return submitBallotInputSchema.parse(rawInput);
    } catch {
      throw badRequest("invalid ballot submission input");
    }
  })();
  const receivedAt = nowFrom(context);
  const { session, handleHash } = await requireVoterSession(repository, context);
  const [election, questions] = await Promise.all([
    requireElection(repository, session.electionId),
    repository.listQuestionsWithOptions(session.electionId)
  ]);
  ensureSubmitAllowed(election);
  const credential = await repository.findVotingCredential(session.votingCredentialId);
  if (!credential) {
    throw createAuthenticationError("credential not found for voter session");
  }
  if (credential.hasVoted) {
    throw revoteDisabled("revote disabled for completed credential");
  }
  const pass = await getOrCreateAnonymousVotingPass(repository, election.id, session.votingCredentialId);
  const { group, tokenToStore } = await getOrCreateAnonymousBallotGroup({
    repository,
    election,
    context
  });
  assertBallotGroupTokenHashIsRandomTokenBased({
    tokenHash: group.ballotGroupTokenHash,
    hmacKey: context.hmacKey,
    forbiddenIdentifierValues: [
      session.eligibleVoterId,
      session.votingCredentialId,
      session.sessionId,
      session.opaqueHandleHash
    ]
  });

  let votes: VoteCreateInput[];
  try {
    votes = validateAnswers(questions, parsed.answers, context.hmacKey);
  } catch (error) {
    await repository.recordSubmissionEvent({
      electionId: election.id,
      eventType: "submission_failed",
      serverReceivedAt: receivedAt,
      reasonCode: error instanceof Error ? "validation_failed" : "unknown_failure",
      ...submissionContext(context)
    });
    throw error;
  }

  const accepted = receivedAt.getTime() <= election.endsAt.getTime();
  const acceptanceStatus = accepted ? "accepted" : "rejected_late";
  const receipt = receiptHash(`${randomBytes(16).toString("hex")}:${receivedAt.toISOString()}`, context.hmacKey);
  const transactionResult = await repository.submitBallotTransaction({
    accepted,
    votingCredentialId: session.votingCredentialId,
    anonymousPassId: pass.id,
    ballot: {
      electionId: election.id,
      anonymousBallotGroupId: group.id,
      serverReceivedAt: receivedAt,
      submissionStatus: "received",
      acceptanceStatus,
      isCurrent: accepted,
      receiptHash: receipt,
      votes
    },
    submissionEvents: [
      {
        electionId: election.id,
        eventType: "submission_started",
        serverReceivedAt: receivedAt,
        ...submissionContext(context)
      },
      {
        electionId: election.id,
        eventType: accepted ? "submission_accepted" : "late_rejected",
        serverReceivedAt: receivedAt,
        acceptanceStatus,
        reasonCode: accepted ? undefined : "after_election_end",
        ...submissionContext(context)
      },
      ...(accepted && group.currentBallotId
        ? [
            {
              electionId: election.id,
              eventType: "superseded" as const,
              serverReceivedAt: receivedAt,
              reasonCode: "revote_submitted",
              ...submissionContext(context)
            }
          ]
        : [])
    ]
  });
  await repository.touchVoterSession(handleHash, receivedAt);

  return Object.freeze({
    response: Object.freeze({
      accepted,
      submitted_at: receivedAt.toISOString(),
      receipt_preview: accepted ? receiptPreview(receipt) : undefined,
      current_ballot_replaced: transactionResult.supersededBallotIds.length > 0,
      tally_eligible: isBallotEligibleForTally(transactionResult.ballot, election)
    }),
    ballotGroupCookie: tokenToStore
      ? {
          name: BALLOT_GROUP_COOKIE_POLICY.name,
          value: tokenToStore,
          expires: election.endsAt
        }
      : undefined
  });
}

export async function submitRevote(
  repository: BallotRepository,
  rawInput: unknown,
  context: VoterRequestContext
): Promise<SubmitBallotServiceResult> {
  throw revoteDisabled("revote endpoint disabled");
}

export const voterBallotCookiePolicies = Object.freeze({
  voterSession: VOTER_SESSION_COOKIE_POLICY,
  ballotGroup: BALLOT_GROUP_COOKIE_POLICY
});
