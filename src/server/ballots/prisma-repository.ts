import {
  AnonymousVotingPassStatus,
  BallotAcceptanceStatus,
  BallotSubmissionStatus,
  ElectionState,
  Prisma,
  QuestionType,
  RecordStatus,
  SubmissionEventType,
  VoteAnswerType
} from "@prisma/client";

import type { PrismaClientLike } from "../db/prisma";
import type { VoterSessionRecord } from "../voters/repository";
import type {
  AnonymousBallotGroupRecord,
  AnonymousVotingPassRecord,
  BallotRecord,
  BallotRepository,
  BallotSubmissionCommand,
  QuestionWithOptionsRecord,
  SubmissionEventInput,
  VoterElectionRecord,
  VotingCredentialParticipationRecord
} from "./repository";

function mapElection(record: {
  id: string;
  title: string;
  description: string | null;
  votingMode: string;
  state: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
}): VoterElectionRecord {
  return Object.freeze({
    id: record.id,
    title: record.title,
    description: record.description,
    votingMode: record.votingMode as VoterElectionRecord["votingMode"],
    state: record.state as VoterElectionRecord["state"],
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    timezone: record.timezone
  });
}

function mapQuestion(record: {
  id: string;
  title: string;
  description: string | null;
  questionType: string;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  displayOrder: number;
  status: string;
  options: {
    id: string;
    label: string;
    description: string | null;
    displayOrder: number;
    status: string;
  }[];
}): QuestionWithOptionsRecord {
  return Object.freeze({
    id: record.id,
    title: record.title,
    description: record.description,
    questionType: record.questionType as QuestionWithOptionsRecord["questionType"],
    required: record.required,
    minSelect: record.minSelect,
    maxSelect: record.maxSelect,
    displayOrder: record.displayOrder,
    status: record.status as QuestionWithOptionsRecord["status"],
    options: record.options.map((option) =>
      Object.freeze({
        id: option.id,
        label: option.label,
        description: option.description,
        displayOrder: option.displayOrder,
        status: option.status as RecordStatus
      })
    )
  });
}

function mapVoterSession(record: {
  id: string;
  opaqueHandleHash: string;
  electionId: string;
  eligibleVoterId: string;
  votingCredentialId: string;
  authenticationMethod: string;
  authenticated: boolean;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}): VoterSessionRecord {
  return Object.freeze({
    sessionId: record.id,
    opaqueHandleHash: record.opaqueHandleHash,
    electionId: record.electionId,
    eligibleVoterId: record.eligibleVoterId,
    votingCredentialId: record.votingCredentialId,
    authenticationMethod: record.authenticationMethod as VoterSessionRecord["authenticationMethod"],
    authenticated: record.authenticated,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    lastUsedAt: record.lastUsedAt
  });
}

function mapPass(record: {
  id: string;
  electionId: string;
  votingCredentialId: string;
  passStatus: string;
  usedAt: Date | null;
  usageCount: number;
}): AnonymousVotingPassRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    votingCredentialId: record.votingCredentialId,
    passStatus: record.passStatus as AnonymousVotingPassRecord["passStatus"],
    usedAt: record.usedAt,
    usageCount: record.usageCount
  });
}

function mapGroup(record: {
  id: string;
  electionId: string;
  ballotGroupTokenHash: string;
  currentBallotId: string | null;
  submissionCount: number;
}): AnonymousBallotGroupRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    ballotGroupTokenHash: record.ballotGroupTokenHash,
    currentBallotId: record.currentBallotId,
    submissionCount: record.submissionCount
  });
}

function mapBallot(record: {
  id: string;
  electionId: string;
  anonymousBallotGroupId: string | null;
  submissionStatus: string;
  acceptanceStatus: string;
  serverReceivedAt: Date;
  isCurrent: boolean;
  receiptHash: string;
}): BallotRecord {
  if (!record.anonymousBallotGroupId) {
    throw new Error("anonymous ballot must have anonymousBallotGroupId");
  }
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    anonymousBallotGroupId: record.anonymousBallotGroupId,
    submissionStatus: record.submissionStatus as BallotRecord["submissionStatus"],
    acceptanceStatus: record.acceptanceStatus as BallotRecord["acceptanceStatus"],
    serverReceivedAt: record.serverReceivedAt,
    isCurrent: record.isCurrent,
    receiptHash: record.receiptHash
  });
}

function submissionEventData(event: SubmissionEventInput) {
  return {
    electionId: event.electionId,
    ballotId: event.ballotId,
    eventType: event.eventType as SubmissionEventType,
    serverReceivedAt: event.serverReceivedAt,
    acceptanceStatus: event.acceptanceStatus as BallotAcceptanceStatus | undefined,
    reasonCode: event.reasonCode,
    ipMasked: event.ipMasked,
    ipHash: event.ipHash,
    userAgentSummary: event.userAgentSummary
  };
}

export class PrismaBallotRepository implements BallotRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findVoterSessionByHandleHash(
    handleHash: string,
    now = new Date()
  ): Promise<VoterSessionRecord | null> {
    const session = await this.prisma.voterSession.findUnique({
      where: { opaqueHandleHash: handleHash }
    });
    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }
    return mapVoterSession(session);
  }

  async touchVoterSession(handleHash: string, touchedAt = new Date()): Promise<void> {
    await this.prisma.voterSession.update({
      where: { opaqueHandleHash: handleHash },
      data: { lastUsedAt: touchedAt }
    });
  }

  async findElectionById(electionId: string): Promise<VoterElectionRecord | null> {
    const election = await this.prisma.election.findUnique({ where: { id: electionId } });
    return election ? mapElection(election) : null;
  }

  async listQuestionsWithOptions(electionId: string): Promise<QuestionWithOptionsRecord[]> {
    const questions = await this.prisma.question.findMany({
      where: { electionId, status: RecordStatus.active },
      orderBy: { displayOrder: "asc" },
      include: {
        options: {
          where: { status: RecordStatus.active },
          orderBy: { displayOrder: "asc" }
        }
      }
    });
    return questions.map(mapQuestion);
  }

  async findVotingCredential(
    id: string
  ): Promise<VotingCredentialParticipationRecord | null> {
    const credential = await this.prisma.votingCredential.findUnique({
      where: { id },
      select: {
        id: true,
        electionId: true,
        hasVoted: true,
        lastVoteConfirmedAt: true,
        submissionCount: true
      }
    });
    return credential ? Object.freeze(credential) : null;
  }

  async updateVotingCredentialParticipation(input: {
    votingCredentialId: string;
    hasVoted: boolean;
    lastVoteConfirmedAt?: Date;
    incrementSubmissionCount?: boolean;
  }): Promise<void> {
    await this.prisma.votingCredential.update({
      where: { id: input.votingCredentialId },
      data: {
        hasVoted: input.hasVoted,
        lastVoteConfirmedAt: input.lastVoteConfirmedAt,
        ...(input.incrementSubmissionCount ? { submissionCount: { increment: 1 } } : {})
      }
    });
  }

  async findAnonymousVotingPassByCredential(
    electionId: string,
    votingCredentialId: string
  ): Promise<AnonymousVotingPassRecord | null> {
    const pass = await this.prisma.anonymousVotingPass.findUnique({
      where: { electionId_votingCredentialId: { electionId, votingCredentialId } }
    });
    return pass ? mapPass(pass) : null;
  }

  async createAnonymousVotingPass(input: {
    electionId: string;
    votingCredentialId: string;
  }): Promise<AnonymousVotingPassRecord> {
    const pass = await this.prisma.anonymousVotingPass.create({
      data: {
        electionId: input.electionId,
        votingCredentialId: input.votingCredentialId,
        passStatus: AnonymousVotingPassStatus.issued
      }
    });
    return mapPass(pass);
  }

  async markAnonymousVotingPassUsed(input: {
    passId: string;
    usedAt: Date;
  }): Promise<AnonymousVotingPassRecord> {
    const pass = await this.prisma.anonymousVotingPass.update({
      where: { id: input.passId },
      data: {
        passStatus: AnonymousVotingPassStatus.used,
        usedAt: input.usedAt,
        usageCount: { increment: 1 }
      }
    });
    return mapPass(pass);
  }

  async findAnonymousBallotGroupByTokenHash(
    electionId: string,
    tokenHash: string
  ): Promise<AnonymousBallotGroupRecord | null> {
    const group = await this.prisma.anonymousBallotGroup.findUnique({
      where: { electionId_ballotGroupTokenHash: { electionId, ballotGroupTokenHash: tokenHash } }
    });
    return group ? mapGroup(group) : null;
  }

  async createAnonymousBallotGroup(input: {
    electionId: string;
    tokenHash: string;
  }): Promise<AnonymousBallotGroupRecord> {
    const group = await this.prisma.anonymousBallotGroup.create({
      data: {
        electionId: input.electionId,
        ballotGroupTokenHash: input.tokenHash
      }
    });
    return mapGroup(group);
  }

  async submitBallotTransaction(input: {
    ballot: BallotSubmissionCommand;
    submissionEvents: readonly SubmissionEventInput[];
    accepted: boolean;
    votingCredentialId: string;
    anonymousPassId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      let supersededBallotIds: string[] = [];
      if (input.accepted) {
        const previous = await tx.ballot.findMany({
          where: {
            anonymousBallotGroupId: input.ballot.anonymousBallotGroupId,
            isCurrent: true
          },
          select: { id: true }
        });
        supersededBallotIds = previous.map((ballot) => ballot.id);
        // Application-level current flip is backed by the PostgreSQL partial unique index:
        // unique_current_ballot_per_group ON ballots (anonymous_ballot_group_id) WHERE is_current = true.
        await tx.ballot.updateMany({
          where: {
            anonymousBallotGroupId: input.ballot.anonymousBallotGroupId,
            isCurrent: true
          },
          data: {
            isCurrent: false,
            acceptanceStatus: BallotAcceptanceStatus.superseded,
            supersededAt: input.ballot.serverReceivedAt
          }
        });
      }

      const ballot = await tx.ballot.create({
        data: {
          electionId: input.ballot.electionId,
          anonymousBallotGroupId: input.ballot.anonymousBallotGroupId,
          submissionStatus: input.ballot.submissionStatus as BallotSubmissionStatus,
          acceptanceStatus: input.ballot.acceptanceStatus as BallotAcceptanceStatus,
          serverReceivedAt: input.ballot.serverReceivedAt,
          isCurrent: input.ballot.isCurrent,
          receiptHash: input.ballot.receiptHash,
          votes: {
            create: input.ballot.votes.map((vote) => ({
              questionId: vote.questionId,
              answerType: vote.answerType as VoteAnswerType,
              freeTextEncrypted: vote.freeTextEncrypted,
              options: {
                create: vote.optionIds.map((optionId) => ({ optionId }))
              }
            }))
          }
        }
      });

      await tx.submissionEvent.createMany({
        data: input.submissionEvents.map((event) =>
          submissionEventData({
            ...event,
            ballotId: event.ballotId ?? ballot.id
          })
        )
      });

      if (input.accepted) {
        await tx.anonymousBallotGroup.update({
          where: { id: input.ballot.anonymousBallotGroupId },
          data: {
            currentBallotId: ballot.id,
            submissionCount: { increment: 1 },
            lastSubmittedAt: input.ballot.serverReceivedAt
          }
        });
        await tx.anonymousVotingPass.update({
          where: { id: input.anonymousPassId },
          data: {
            passStatus: AnonymousVotingPassStatus.used,
            usedAt: input.ballot.serverReceivedAt,
            usageCount: { increment: 1 }
          }
        });
        await tx.votingCredential.update({
          where: { id: input.votingCredentialId },
          data: {
            hasVoted: true,
            lastVoteConfirmedAt: input.ballot.serverReceivedAt,
            submissionCount: { increment: 1 }
          }
        });
      }

      const currentBallotCount = await tx.ballot.count({
        where: {
          anonymousBallotGroupId: input.ballot.anonymousBallotGroupId,
          isCurrent: true
        }
      });

      return Object.freeze({
        ballot: mapBallot(ballot),
        supersededBallotIds,
        currentBallotCount
      });
    });
  }

  async recordSubmissionEvent(input: SubmissionEventInput): Promise<void> {
    await this.prisma.submissionEvent.create({
      data: submissionEventData(input)
    });
  }
}

export function createPrismaBallotRepository(prisma: PrismaClientLike): BallotRepository {
  return new PrismaBallotRepository(prisma);
}
