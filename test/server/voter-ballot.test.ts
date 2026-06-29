import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { isBallotEligibleForTally } from "../../src/domain/ballots/ballot-policy";
import { ElectionState } from "../../src/guardrails/index.js";
import { VOTER_SESSION_COOKIE_POLICY, hashOpaqueHandle } from "../../src/server/auth/voter-session";
import { BALLOT_GROUP_COOKIE_POLICY } from "../../src/server/ballots/ballot-group-token";
import {
  getVoterCompletionStatus,
  getVoterElectionInfo,
  submitAnonymousBallot,
  submitRevote
} from "../../src/server/ballots/ballot-service";
import {
  handleSubmitBallotRoute,
  type VoterBallotRouteDependencies
} from "../../src/server/ballots/route-handlers";
import type {
  AnonymousBallotGroupRecord,
  AnonymousVotingPassRecord,
  BallotRecord,
  BallotRepository,
  BallotSubmissionCommand,
  QuestionWithOptionsRecord,
  SubmissionEventInput,
  SubmitBallotTransactionResult,
  VoterElectionRecord,
  VotingCredentialParticipationRecord
} from "../../src/server/ballots/repository";
import type { VoterSessionRecord } from "../../src/server/voters/repository";

const hmacKey = "voter-ballot-test-hmac-key-32-chars";
const now = new Date("2026-01-01T00:00:00.000Z");
const electionId = "10000000-0000-4000-8000-000000000001";
const credentialId = "20000000-0000-4000-8000-000000000001";
const eligibleVoterId = "30000000-0000-4000-8000-000000000001";
const sessionHandle = "opaque-voter-session-handle";
const sessionHash = hashOpaqueHandle(sessionHandle, hmacKey);
const questionId = "40000000-0000-4000-8000-000000000001";
const optionAId = "50000000-0000-4000-8000-000000000001";
const optionBId = "50000000-0000-4000-8000-000000000002";

class InMemoryBallotRepository implements BallotRepository {
  election: VoterElectionRecord = {
    id: electionId,
    title: "Anonymous Vote",
    votingMode: "anonymous",
    state: ElectionState.OPEN,
    startsAt: new Date("2025-12-31T00:00:00.000Z"),
    endsAt: new Date("2026-01-02T00:00:00.000Z"),
    timezone: "Asia/Seoul"
  };
  questions: QuestionWithOptionsRecord[] = [
    {
      id: questionId,
      title: "Choose one",
      questionType: "single_choice",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      displayOrder: 1,
      status: "active",
      options: [
        { id: optionAId, label: "A", displayOrder: 1, status: "active" },
        { id: optionBId, label: "B", displayOrder: 2, status: "active" }
      ]
    }
  ];
  session: VoterSessionRecord = {
    sessionId: "session-1",
    opaqueHandleHash: sessionHash,
    electionId,
    eligibleVoterId,
    votingCredentialId: credentialId,
    authenticationMethod: "invite_link_with_identifier",
    authenticated: true,
    issuedAt: now,
    expiresAt: new Date("2026-01-01T00:15:00.000Z")
  };
  credential: VotingCredentialParticipationRecord = {
    id: credentialId,
    electionId,
    hasVoted: false,
    submissionCount: 0
  };
  passes = new Map<string, AnonymousVotingPassRecord>();
  groups = new Map<string, AnonymousBallotGroupRecord>();
  ballots: BallotRecord[] = [];
  votes: Array<{ ballotId: string; questionId: string; optionIds: readonly string[]; freeTextEncrypted?: string }> = [];
  submissionEvents: SubmissionEventInput[] = [];
  touched = 0;
  private seq = 1;

  id(prefix: string) {
    return `${prefix}-${this.seq++}`;
  }

  async findVoterSessionByHandleHash(handleHash: string, at = now) {
    if (handleHash !== this.session.opaqueHandleHash || this.session.expiresAt <= at) {
      return null;
    }
    return this.session;
  }

  async touchVoterSession() {
    this.touched += 1;
  }

  async findElectionById(id: string) {
    return id === this.election.id ? this.election : null;
  }

  async listQuestionsWithOptions() {
    return this.questions;
  }

  async findVotingCredential(id: string) {
    return id === this.credential.id ? this.credential : null;
  }

  async updateVotingCredentialParticipation(input: {
    votingCredentialId: string;
    hasVoted: boolean;
    lastVoteConfirmedAt?: Date;
    incrementSubmissionCount?: boolean;
  }) {
    this.credential = {
      ...this.credential,
      hasVoted: input.hasVoted,
      lastVoteConfirmedAt: input.lastVoteConfirmedAt,
      submissionCount: this.credential.submissionCount + (input.incrementSubmissionCount ? 1 : 0)
    };
  }

  async findAnonymousVotingPassByCredential(_electionId: string, votingCredentialId: string) {
    return this.passes.get(votingCredentialId) ?? null;
  }

  async createAnonymousVotingPass(input: { electionId: string; votingCredentialId: string }) {
    const pass: AnonymousVotingPassRecord = {
      id: this.id("pass"),
      electionId: input.electionId,
      votingCredentialId: input.votingCredentialId,
      passStatus: "issued",
      usageCount: 0
    };
    this.passes.set(input.votingCredentialId, pass);
    return pass;
  }

  async markAnonymousVotingPassUsed(input: { passId: string; usedAt: Date }) {
    const [credentialKey, pass] = [...this.passes.entries()].find(
      ([, candidate]) => candidate.id === input.passId
    )!;
    const updated = { ...pass, passStatus: "used" as const, usedAt: input.usedAt, usageCount: pass.usageCount + 1 };
    this.passes.set(credentialKey, updated);
    return updated;
  }

  async findAnonymousBallotGroupByTokenHash(_electionId: string, tokenHash: string) {
    return this.groups.get(tokenHash) ?? null;
  }

  async createAnonymousBallotGroup(input: { electionId: string; tokenHash: string }) {
    const group: AnonymousBallotGroupRecord = {
      id: this.id("group"),
      electionId: input.electionId,
      ballotGroupTokenHash: input.tokenHash,
      currentBallotId: null,
      submissionCount: 0
    };
    this.groups.set(input.tokenHash, group);
    return group;
  }

  async submitBallotTransaction(input: {
    ballot: BallotSubmissionCommand;
    submissionEvents: readonly SubmissionEventInput[];
    accepted: boolean;
    votingCredentialId: string;
    anonymousPassId: string;
  }): Promise<SubmitBallotTransactionResult> {
    let supersededBallotIds: string[] = [];
    if (input.accepted) {
      supersededBallotIds = this.ballots
        .filter(
          (ballot) =>
            ballot.anonymousBallotGroupId === input.ballot.anonymousBallotGroupId &&
            ballot.isCurrent
        )
        .map((ballot) => ballot.id);
      this.ballots = this.ballots.map((ballot) =>
        supersededBallotIds.includes(ballot.id)
          ? { ...ballot, isCurrent: false, acceptanceStatus: "superseded" }
          : ballot
      );
    }
    const ballot: BallotRecord = {
      id: this.id("ballot"),
      electionId: input.ballot.electionId,
      anonymousBallotGroupId: input.ballot.anonymousBallotGroupId,
      submissionStatus: input.ballot.submissionStatus,
      acceptanceStatus: input.ballot.acceptanceStatus,
      serverReceivedAt: input.ballot.serverReceivedAt,
      isCurrent: input.ballot.isCurrent,
      receiptHash: input.ballot.receiptHash
    };
    this.ballots.push(ballot);
    this.votes.push(
      ...input.ballot.votes.map((vote) => ({
        ballotId: ballot.id,
        questionId: vote.questionId,
        optionIds: vote.optionIds,
        freeTextEncrypted: vote.freeTextEncrypted
      }))
    );
    this.submissionEvents.push(...input.submissionEvents.map((event) => ({ ...event, ballotId: ballot.id })));
    if (input.accepted) {
      const group = [...this.groups.values()].find((candidate) => candidate.id === input.ballot.anonymousBallotGroupId)!;
      this.groups.set(group.ballotGroupTokenHash, {
        ...group,
        currentBallotId: ballot.id,
        submissionCount: group.submissionCount + 1
      });
      await this.markAnonymousVotingPassUsed({ passId: input.anonymousPassId, usedAt: input.ballot.serverReceivedAt });
      await this.updateVotingCredentialParticipation({
        votingCredentialId: input.votingCredentialId,
        hasVoted: true,
        lastVoteConfirmedAt: input.ballot.serverReceivedAt,
        incrementSubmissionCount: true
      });
    }
    return {
      ballot,
      supersededBallotIds,
      currentBallotCount: this.ballots.filter(
        (candidate) =>
          candidate.anonymousBallotGroupId === input.ballot.anonymousBallotGroupId &&
          candidate.isCurrent
      ).length
    };
  }

  async recordSubmissionEvent(input: SubmissionEventInput) {
    this.submissionEvents.push(input);
  }
}

function answer(optionId = optionAId) {
  return { answers: [{ questionId, optionIds: [optionId] }] };
}

function context(overrides: Partial<Parameters<typeof submitAnonymousBallot>[2]> = {}) {
  return {
    voterSessionHandle: sessionHandle,
    hmacKey,
    now,
    ipAddress: "203.0.113.42",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0",
    ...overrides
  };
}

describe("voter anonymous ballot service", () => {
  it("returns voter election info without previous selections", async () => {
    const repository = new InMemoryBallotRepository();
    const info = await getVoterElectionInfo(repository, context());

    expect(info).toMatchObject({ voting_mode: "anonymous", state: ElectionState.OPEN });
    expect(JSON.stringify(info)).not.toContain("selected");
    expect(JSON.stringify(info)).not.toContain("votingCredentialId");
  });

  it("allows submitting in Open state and creates random token-based ballot group", async () => {
    const repository = new InMemoryBallotRepository();
    const result = await submitAnonymousBallot(repository, answer(), context());

    expect(result.response.accepted).toBe(true);
    expect(result.response.receipt_preview).toHaveLength(12);
    expect(result.ballotGroupCookie?.value).toBeTruthy();
    expect(repository.groups.size).toBe(1);
    const group = [...repository.groups.values()][0];
    expect(group.ballotGroupTokenHash).not.toBe(eligibleVoterId);
    expect(group.ballotGroupTokenHash).not.toBe(credentialId);
    expect(JSON.stringify(result.response)).not.toContain(result.ballotGroupCookie!.value);
  });

  it("rejects submitting in Paused or Closed state", async () => {
    const repository = new InMemoryBallotRepository();
    repository.election = { ...repository.election, state: ElectionState.PAUSED };
    await expect(submitAnonymousBallot(repository, answer(), context())).rejects.toThrow(
      /현재 투표 상태/
    );

    repository.election = { ...repository.election, state: ElectionState.CLOSED };
    await expect(submitAnonymousBallot(repository, answer(), context())).rejects.toThrow(
      /현재 투표 상태/
    );
  });

  it("records late submissions as rejected and not current", async () => {
    const repository = new InMemoryBallotRepository();
    repository.election = {
      ...repository.election,
      endsAt: new Date("2025-12-31T23:59:00.000Z")
    };
    const result = await submitAnonymousBallot(repository, answer(), context());

    expect(result.response.accepted).toBe(false);
    expect(repository.ballots[0]).toMatchObject({
      acceptanceStatus: "rejected_late",
      isCurrent: false
    });
  });

  it("revotes with client-held token, creates a new Ballot, and keeps only the last accepted current", async () => {
    const repository = new InMemoryBallotRepository();
    const first = await submitAnonymousBallot(repository, answer(optionAId), context());
    const second = await submitRevote(
      repository,
      answer(optionBId),
      context({ ballotGroupToken: first.ballotGroupCookie!.value, now: new Date("2026-01-01T00:01:00.000Z") })
    );

    expect(second.response.current_ballot_replaced).toBe(true);
    expect(repository.groups.size).toBe(1);
    expect(repository.ballots).toHaveLength(2);
    expect(repository.ballots.filter((ballot) => ballot.isCurrent)).toHaveLength(1);
    expect(repository.ballots[0]).toMatchObject({ isCurrent: false, acceptanceStatus: "superseded" });
    expect(repository.ballots[1]).toMatchObject({ isCurrent: true, acceptanceStatus: "accepted" });
  });

  it("matches official tally eligibility criteria", async () => {
    const repository = new InMemoryBallotRepository();
    await submitAnonymousBallot(repository, answer(), context());

    expect(isBallotEligibleForTally(repository.ballots[0], repository.election)).toBe(true);
  });

  it("validates required questions and min max option counts", async () => {
    const repository = new InMemoryBallotRepository();
    await expect(submitAnonymousBallot(repository, { answers: [] }, context())).rejects.toThrow(
      /입력값/
    );
    await expect(
      submitAnonymousBallot(repository, { answers: [{ questionId, optionIds: [optionAId, optionBId] }] }, context())
    ).rejects.toThrow(/입력값/);
  });

  it("does not expose selections in completion status", async () => {
    const repository = new InMemoryBallotRepository();
    await submitAnonymousBallot(repository, answer(), context());
    const status = await getVoterCompletionStatus(repository, context());

    expect(status).toMatchObject({ completed: true });
    expect(JSON.stringify(status)).not.toContain(optionAId);
    expect(JSON.stringify(status)).not.toContain("answers");
  });

  it("does not store voter, credential, session, or token plaintext in anonymous submission records", async () => {
    const repository = new InMemoryBallotRepository();
    const result = await submitAnonymousBallot(repository, answer(), context());
    const serialized = JSON.stringify({
      groups: repository.groups,
      ballots: repository.ballots,
      votes: repository.votes,
      submissionEvents: repository.submissionEvents
    });

    expect(serialized).not.toContain(eligibleVoterId);
    expect(serialized).not.toContain(credentialId);
    expect(serialized).not.toContain(repository.session.sessionId);
    expect(serialized).not.toContain(result.ballotGroupCookie!.value);
    expect(serialized).not.toContain("votingCredentialId");
    expect(serialized).not.toContain("eligibleVoterId");
    expect(serialized).not.toContain("voterSessionId");
  });

  it("keeps pass and voter session free of BallotGroup identifiers", async () => {
    const repository = new InMemoryBallotRepository();
    await submitAnonymousBallot(repository, answer(), context());

    expect(JSON.stringify(repository.session)).not.toContain("anonymousBallotGroup");
    expect(JSON.stringify([...repository.passes.values()])).not.toContain("ballotGroupTokenHash");
    expect(JSON.stringify([...repository.passes.values()])).not.toContain("anonymousBallotGroupId");
  });

  it("route skeleton uses voter session cookie and does not return token plaintext", async () => {
    const repository = new InMemoryBallotRepository();
    const request = new NextRequest("https://example.test/api/v1/voter/ballots", {
      method: "POST",
      body: JSON.stringify(answer()),
      headers: {
        "content-type": "application/json",
        cookie: `${VOTER_SESSION_COOKIE_POLICY.name}=${sessionHandle}`
      }
    });
    const response = await handleSubmitBallotRoute(request, {
      repository,
      hmacKey,
      now
    } satisfies VoterBallotRouteDependencies);
    const body = await response.json();
    const cookie = response.cookies.get(BALLOT_GROUP_COOKIE_POLICY.name);

    expect(response.status).toBe(200);
    expect(cookie?.value).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(cookie!.value);
    expect(JSON.stringify(body)).not.toContain("anonymousBallotGroup");
  });
});
