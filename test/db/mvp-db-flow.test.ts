import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDefaultAuthenticationMethod } from "../../src/domain/auth-policy/authentication-policy";
import { ElectionState, PERMISSION_CODES, Role } from "../../src/guardrails/index.js";
import { createMockAdminSession } from "../../src/server/auth/admin-session";
import { hashOpaqueHandle } from "../../src/server/auth/voter-session";
import {
  getVoterCompletionStatus,
  getVoterElectionInfo,
  submitAnonymousBallot,
  submitRevote
} from "../../src/server/ballots/ballot-service";
import { createPrismaBallotRepository } from "../../src/server/ballots/prisma-repository";
import { createPrismaElectionRepository } from "../../src/server/elections/prisma-repository";
import {
  approveElectionReview,
  closeElection,
  createElectionDraft,
  createOption,
  createQuestion,
  importEligibleVoters,
  issueInvitations,
  openElection,
  prepareInvitationsForElection,
  requestElectionReview,
  scheduleElection
} from "../../src/server/elections/election-service";
import { getPrismaClient, type PrismaClientLike } from "../../src/server/db/prisma";
import { createPrismaResultRepository } from "../../src/server/results/prisma-repository";
import {
  confirmResult,
  getPublicElectionResult,
  publishResult,
  tallyElectionResult
} from "../../src/server/results/result-service";
import { createPrismaVoterAuthRepository } from "../../src/server/voters/prisma-repository";
import {
  hashInviteToken,
  verifyInvitationToken,
  verifyVoterIdentifier
} from "../../src/server/voters/voter-auth-service";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const hmacKey = process.env.HMAC_KEY ?? "mvp-db-flow-test-hmac-key-with-32-chars";
const now = new Date("2026-01-01T00:10:00.000Z");
const allPermissions = PERMISSION_CODES;

function adminSession(input: {
  tenantId: string;
  organizationId: string;
  userId: string;
}) {
  return createMockAdminSession({
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    userId: input.userId,
    roles: [Role.ORGANIZATION_OWNER],
    permissions: allPermissions,
    issuedAt: now,
    expiresAt: new Date("2026-01-01T02:00:00.000Z"),
    stepUp: {
      verifiedAt: now,
      expiresAt: new Date("2026-01-01T02:00:00.000Z"),
      permissionCodes: allPermissions
    }
  });
}

async function clearElectionData(prisma: PrismaClientLike, electionId: string) {
  await prisma.anonymousBallotGroup.updateMany({
    where: { electionId },
    data: { currentBallotId: null }
  });
  await prisma.reportExport.deleteMany({ where: { report: { electionId } } });
  await prisma.report.deleteMany({ where: { electionId } });
  await prisma.correctionRequest.deleteMany({ where: { electionId } });
  await prisma.invalidationRecord.deleteMany({ where: { electionId } });
  await prisma.resultVersion.deleteMany({ where: { electionId } });
  await prisma.resultItem.deleteMany({ where: { result: { electionId } } });
  await prisma.result.deleteMany({ where: { electionId } });
  await prisma.voteOption.deleteMany({ where: { vote: { ballot: { electionId } } } });
  await prisma.vote.deleteMany({ where: { ballot: { electionId } } });
  await prisma.submissionEvent.deleteMany({ where: { electionId } });
  await prisma.ballot.deleteMany({ where: { electionId } });
  await prisma.anonymousBallotGroup.deleteMany({ where: { electionId } });
  await prisma.anonymousVotingPass.deleteMany({ where: { electionId } });
  await prisma.voterSession.deleteMany({ where: { electionId } });
  await prisma.credentialEvent.deleteMany({ where: { electionId } });
  await prisma.invitation.deleteMany({ where: { electionId } });
  await prisma.votingCredential.deleteMany({ where: { electionId } });
  await prisma.eligibleVoter.deleteMany({ where: { electionId } });
  await prisma.voterRegistryValidationError.deleteMany({
    where: { import: { registry: { electionId } } }
  });
  await prisma.voterRegistryImport.deleteMany({ where: { registry: { electionId } } });
  await prisma.voterRegistry.deleteMany({ where: { electionId } });
  await prisma.option.deleteMany({ where: { question: { electionId } } });
  await prisma.question.deleteMany({ where: { electionId } });
  await prisma.authenticationPolicy.deleteMany({ where: { electionId } });
  await prisma.electionChangeHistory.deleteMany({ where: { electionId } });
  await prisma.electionStateHistory.deleteMany({ where: { electionId } });
  await prisma.deliveryEvent.deleteMany({ where: { electionId } });
  await prisma.election.deleteMany({ where: { id: electionId } });
}

describeDb("MVP Prisma repository flow", () => {
  let prisma: PrismaClientLike;

  beforeAll(() => {
    prisma = getPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("runs the core anonymous voting flow against PostgreSQL without exposing forbidden links", async () => {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: { name: `mvp-flow-tenant-${suffix}` }
    });
    const organization = await prisma.organization.create({
      data: { tenantId: tenant.id, name: `mvp-flow-org-${suffix}` }
    });
    const admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        organizationId: organization.id,
        emailHash: `admin-email-hash-${suffix}`,
        passwordHash: "local-test-password-hash"
      }
    });
    const session = adminSession({
      tenantId: tenant.id,
      organizationId: organization.id,
      userId: admin.id
    });
    const electionRepository = createPrismaElectionRepository(prisma);
    const voterRepository = createPrismaVoterAuthRepository(prisma);
    const ballotRepository = createPrismaBallotRepository(prisma);
    const resultRepository = createPrismaResultRepository(prisma);
    let electionId: string | undefined;

    try {
      const draft = await createElectionDraft(
        {
          title: `MVP DB Flow ${suffix}`,
          electionType: "representative_election",
          votingMode: "anonymous",
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2026-01-01T01:00:00.000Z",
          timezone: "Asia/Seoul"
        },
        { session, repository: electionRepository, hmacKey, now }
      );
      electionId = draft.election.id;
      expect(draft.authenticationPolicy.method).toBe(getDefaultAuthenticationMethod());

      const question = await createQuestion(
        electionId,
        {
          title: "대표를 선택해 주세요.",
          questionType: "single_choice",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          displayOrder: 1
        },
        { session, repository: electionRepository, hmacKey, now }
      );
      const option = await createOption(
        electionId,
        question.id,
        { label: "Candidate A", displayOrder: 1 },
        { session, repository: electionRepository, hmacKey, now }
      );
      await createOption(
        electionId,
        question.id,
        { label: "Candidate B", displayOrder: 2 },
        { session, repository: electionRepository, hmacKey, now }
      );

      await importEligibleVoters(
        electionId,
        {
          sourceType: "manual",
          fileName: "mvp-db-flow.csv",
          fileHash: `file-hash-${suffix}`,
          rows: [
            {
              name: "Test Voter",
              email: `voter-${suffix}@example.test`,
              externalIdentifier: `member-${suffix}`
            }
          ],
          reason: "MVP DB flow voter registry import"
        },
        { session, repository: electionRepository, hmacKey, now }
      );
      await requestElectionReview(
        electionId,
        { reason: "Ready for MVP DB flow" },
        { session, repository: electionRepository, hmacKey, now }
      );
      await approveElectionReview(
        electionId,
        { reason: "Approved for MVP DB flow" },
        { session, repository: electionRepository, hmacKey, now }
      );
      await scheduleElection(
        electionId,
        { reason: "Scheduled for MVP DB flow" },
        { session, repository: electionRepository, hmacKey, now }
      );
      await prepareInvitationsForElection(
        electionId,
        { reason: "Prepare invitations for MVP DB flow" },
        { session, repository: electionRepository, hmacKey, now }
      );
      await issueInvitations(
        electionId,
        { reason: "Send invitations for MVP DB flow", channel: "email" },
        { session, repository: electionRepository, hmacKey, now }
      );
      await openElection(
        electionId,
        { reason: "Open for MVP DB flow" },
        { session, repository: electionRepository, hmacKey, now }
      );

      const inviteToken = `mvp-flow-invite-token-${suffix}`;
      const invitation = await prisma.invitation.findFirstOrThrow({
        where: { electionId },
        orderBy: { createdAt: "asc" }
      });
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { inviteTokenHash: hashInviteToken(inviteToken, hmacKey) }
      });

      const inviteResult = await verifyInvitationToken({
        inviteToken,
        hmacKey,
        repository: voterRepository,
        now
      });
      expect(inviteResult.requiresIdentifier).toBe(true);
      expect(JSON.stringify(inviteResult)).not.toContain(inviteToken);

      const identifierResult = await verifyVoterIdentifier({
        voterSession: inviteResult.voterSession,
        identifier: `member-${suffix}`,
        hmacKey,
        repository: voterRepository,
        now
      });
      expect(identifierResult.authenticated).toBe(true);
      await voterRepository.updateVoterSessionAuthentication({
        handleHash: hashOpaqueHandle(inviteResult.opaqueHandle, hmacKey),
        authenticated: true,
        identifierVerifiedAt: now,
        step: "authenticated"
      });

      const voterContext = {
        voterSessionHandle: inviteResult.opaqueHandle,
        hmacKey,
        now,
        ipAddress: "203.0.113.10",
        userAgent: "Mozilla/5.0 MVP DB Flow"
      };
      const voterInfo = await getVoterElectionInfo(ballotRepository, voterContext);
      expect(JSON.stringify(voterInfo)).not.toMatch(
        /eligibleVoterId|votingCredentialId|anonymousBallotGroupId|ballotGroupTokenHash/
      );

      const firstSubmission = await submitAnonymousBallot(
        ballotRepository,
        {
          answers: [{ questionId: question.id, optionIds: [option.id] }]
        },
        voterContext
      );
      expect(firstSubmission.response.accepted).toBe(true);
      expect(firstSubmission.ballotGroupCookie?.value).toBeTruthy();
      expect(JSON.stringify(firstSubmission.response)).not.toContain(firstSubmission.ballotGroupCookie?.value);

      const revoteSubmission = await submitRevote(
        ballotRepository,
        {
          answers: [{ questionId: question.id, optionIds: [option.id] }]
        },
        {
          ...voterContext,
          ballotGroupToken: firstSubmission.ballotGroupCookie?.value
        }
      );
      expect(revoteSubmission.response.accepted).toBe(true);
      expect(revoteSubmission.response.current_ballot_replaced).toBe(true);

      const currentBallotCount = await prisma.ballot.count({
        where: { electionId, isCurrent: true }
      });
      expect(currentBallotCount).toBe(1);
      const forbiddenLinkCounts = await Promise.all([
        prisma.anonymousBallotGroup.count({
          where: { electionId, ballotGroupTokenHash: inviteResult.voterSession.eligibleVoterId }
        }),
        prisma.submissionEvent.count({ where: { electionId, ballotId: null } })
      ]);
      expect(forbiddenLinkCounts[0]).toBe(0);
      expect(forbiddenLinkCounts[1]).toBe(0);

      const completion = await getVoterCompletionStatus(ballotRepository, voterContext);
      expect(completion).toMatchObject({ completed: true });
      expect(JSON.stringify(completion)).not.toMatch(/answers|optionIds|voteId|ballotId/i);

      await closeElection(
        electionId,
        { reason: "Close for MVP DB flow" },
        { session, repository: electionRepository, hmacKey, now: new Date("2026-01-01T00:40:00.000Z") }
      );
      const resultContext = { session, repository: resultRepository, now: new Date("2026-01-01T00:45:00.000Z") };
      const tally = await tallyElectionResult(electionId, { reason: "Tally MVP DB flow" }, resultContext);
      expect(tally.tally_eligible_ballot_count).toBe(1);
      const confirmed = await confirmResult(
        electionId,
        { reason: "Confirm MVP DB flow" },
        { ...resultContext, now: new Date("2026-01-01T00:50:00.000Z") }
      );
      expect(confirmed.election_state).toBe(ElectionState.CONFIRMED);
      const published = await publishResult(
        electionId,
        { reason: "Publish MVP DB flow", notice: "Published for MVP DB flow" },
        { ...resultContext, now: new Date("2026-01-01T00:55:00.000Z") }
      );
      expect(published.election_state).toBe(ElectionState.PUBLISHED);

      const publicResult = await getPublicElectionResult(electionId, {
        repository: resultRepository,
        now: new Date("2026-01-01T00:56:00.000Z")
      });
      expect(JSON.stringify(publicResult)).not.toMatch(
        /eligibleVoterId|votingCredentialId|anonymousBallotGroupId|ballotGroupTokenHash|inviteToken/
      );
    } finally {
      if (electionId) {
        await clearElectionData(prisma, electionId);
      }
      await prisma.user.deleteMany({ where: { id: admin.id } });
      await prisma.organization.deleteMany({ where: { id: organization.id } });
      await prisma.tenant.deleteMany({ where: { id: tenant.id } });
    }
  });
});
