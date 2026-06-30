import { describe, expect, it } from "vitest";

import { getTallyEligibleBallots } from "../../src/domain/ballots/ballot-policy";
import { canOverwritePublishedResult } from "../../src/domain/results/result-policy";
import {
  AuthenticationMethod,
  ControlRequirement,
  ElectionState,
  PERMISSION_BY_CODE,
  Role
} from "../../src/guardrails/index.js";
import { InMemoryAuditRecorder } from "../../src/server/audit/audit-event";
import { createMockAdminSession } from "../../src/server/auth/admin-session";
import { hashOpaqueHandle } from "../../src/server/auth/voter-session";
import {
  closeElection,
  createElectionDraft,
  createOption,
  createQuestion,
  importEligibleVoters,
  issueInvitations,
  openElection,
  prepareInvitationsForElection,
  requestElectionReview,
  scheduleElection,
  approveElectionReview,
  updateOption
} from "../../src/server/elections/election-service";
import type {
  DeliveryEventInput,
  ElectionChangeHistoryInput,
  ElectionRecord,
  ElectionStateHistoryInput,
  EligibleVoterCreateInput,
  EligibleVoterRecord,
  InvitationCreateInput,
  InvitationRecord,
  ValidationErrorInput,
  VotingCredentialCreateInput
} from "../../src/server/elections/repository";
import { hashInviteToken, hashVoterIdentifier, requestOneTimeCode, verifyInvitationToken, verifyVoterIdentifier } from "../../src/server/voters/voter-auth-service";
import type { CredentialEventInput, VoterSessionAuthenticationCommand, VoterSessionRecord } from "../../src/server/voters/repository";
import {
  getVoterCompletionStatus,
  getVoterElectionInfo,
  submitAnonymousBallot,
  submitRevote
} from "../../src/server/ballots/ballot-service";
import type {
  AnonymousBallotGroupRecord,
  AnonymousVotingPassRecord,
  BallotRecord,
  BallotSubmissionCommand,
  QuestionWithOptionsRecord,
  SubmissionEventInput,
  SubmitBallotTransactionResult
} from "../../src/server/ballots/repository";
import {
  confirmResult,
  createReportExportRequest,
  getPublicElectionResult,
  getReportExportDownloadInfo,
  invalidateElectionResult,
  publishResult,
  requestCorrection,
  approveCorrection,
  tallyElectionResult
} from "../../src/server/results/result-service";
import type {
  CorrectionRequestRecord,
  InvalidationRecordRecord,
  ReportExportRecord,
  ReportRecord,
  ResultItemInput,
  ResultRecord,
  ResultVersionRecord
} from "../../src/server/results/repository";
import { evaluateAnonymousResultPrivacyRisk } from "../../src/server/results/privacy-policy";
import { demoElections } from "../../src/lib/ui/demo-data";

const hmacKey = "mvp-flow-test-hmac-key-with-32-chars";
const now = new Date("2026-01-01T00:00:00.000Z");
const inviteToken = "flow-invite-token";
const voterSessionHandle = "flow-voter-session-handle";

const allPermissions = [
  "election.read",
  "election.create",
  "election.update",
  "question.write",
  "election.request_review",
  "election.approve",
  "election.schedule",
  "election.open",
  "election.close",
  "voter_registry.import",
  "invitation.send",
  "result.read",
  "result.tally",
  "result.confirm",
  "result.publish",
  "result.correct.request",
  "result.correct.approve",
  "election.invalidate",
  "report.create",
  "report.export.request",
  "report.export.download"
];

function adminContext(repository: MvpFlowRepository, auditRecorder = new InMemoryAuditRecorder()) {
  return {
    session: createMockAdminSession({
      roles: [Role.ORGANIZATION_OWNER],
      permissions: allPermissions,
      stepUp: {
        verifiedAt: now,
        expiresAt: new Date("2026-01-01T00:30:00.000Z"),
        permissionCodes: allPermissions
      }
    }),
    repository,
    auditRecorder,
    hmacKey,
    now
  };
}

function resultContext(repository: MvpFlowRepository, auditRecorder = new InMemoryAuditRecorder()) {
  return {
    session: createMockAdminSession({
      roles: [Role.ORGANIZATION_OWNER],
      permissions: allPermissions,
      stepUp: {
        verifiedAt: now,
        expiresAt: new Date("2026-01-01T00:30:00.000Z"),
        permissionCodes: allPermissions
      }
    }),
    repository,
    auditRecorder,
    now
  };
}

function draftInput() {
  return {
    title: "MVP Flow Election",
    electionType: "representative_election",
    votingMode: "anonymous",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-01-01T01:00:00.000Z",
    timezone: "Asia/Seoul"
  };
}

class MvpFlowRepository {
  seq = 1;
  elections = new Map<string, ElectionRecord>();
  questions = new Map<string, any>();
  options = new Map<string, any>();
  policies = new Map<string, any>();
  registries = new Map<string, any>();
  imports = new Map<string, any>();
  voters = new Map<string, any>();
  invitations = new Map<string, any>();
  credentials = new Map<string, any>();
  sessions = new Map<string, VoterSessionRecord>();
  credentialEvents: CredentialEventInput[] = [];
  deliveryEvents: DeliveryEventInput[] = [];
  validationErrors: ValidationErrorInput[] = [];
  stateHistories: ElectionStateHistoryInput[] = [];
  changeHistories: ElectionChangeHistoryInput[] = [];
  passes = new Map<string, AnonymousVotingPassRecord>();
  groups = new Map<string, AnonymousBallotGroupRecord>();
  ballots: BallotRecord[] = [];
  votes: Array<{ ballotId: string; questionId: string; optionIds: readonly string[]; hasFreeText: boolean }> = [];
  submissionEvents: SubmissionEventInput[] = [];
  results: ResultRecord[] = [];
  versions: ResultVersionRecord[] = [];
  corrections: CorrectionRequestRecord[] = [];
  invalidations: InvalidationRecordRecord[] = [];
  reports: ReportRecord[] = [];
  exports: ReportExportRecord[] = [];

  id(prefix: string) {
    return `00000000-0000-4000-8000-${String(this.seq++).padStart(12, "0")}`;
  }

  async createElectionDraft(input: any) {
    const election: ElectionRecord = {
      id: this.id("election"),
      organizationId: input.organizationId,
      createdById: input.createdById,
      title: input.title,
      description: input.description,
      electionType: input.electionType,
      votingMode: input.votingMode,
      state: ElectionState.DRAFT,
      noticeStartsAt: input.noticeStartsAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone
    };
    this.elections.set(election.id, election);
    return election;
  }

  async findElectionById(electionId: string) {
    const election = this.elections.get(electionId);
    return election
      ? {
          ...election,
          startsAt: election.startsAt,
          endsAt: election.endsAt,
          description: election.description ?? null
        }
      : null;
  }

  async listElections(organizationId: string) {
    return [...this.elections.values()].filter((election) => election.organizationId === organizationId && !election.deletedAt);
  }

  async updateElectionDraft(electionId: string, input: any) {
    const updated = { ...this.elections.get(electionId)!, ...input };
    this.elections.set(electionId, updated);
    return updated;
  }

  async updateElectionState(electionId: string, state: string, updates: { startsAt?: Date } = {}) {
    const election = this.elections.get(electionId)!;
    this.elections.set(electionId, { ...election, state: state as ElectionRecord["state"], ...updates });
  }

  async softDeleteElection(input: { electionId: string; deletedAt: Date; deletionReason?: string }) {
    const election = this.elections.get(input.electionId)!;
    this.elections.set(input.electionId, {
      ...election,
      deletedAt: input.deletedAt,
      deletionReason: input.deletionReason
    });
  }

  async createQuestion(electionId: string, input: any) {
    const question = { id: this.id("question"), electionId, status: "active", ...input };
    this.questions.set(question.id, question);
    return question;
  }

  async updateQuestion(questionId: string, input: any) {
    const updated = { ...this.questions.get(questionId)!, ...input };
    this.questions.set(questionId, updated);
    return updated;
  }

  async createOption(questionId: string, input: any) {
    const option = { id: this.id("option"), questionId, status: "active", ...input };
    this.options.set(option.id, option);
    return option;
  }

  async updateOption(optionId: string, input: any) {
    const updated = { ...this.options.get(optionId)!, ...input };
    this.options.set(optionId, updated);
    return updated;
  }

  async findQuestionById(questionId: string) {
    return this.questions.get(questionId) ?? null;
  }

  async findOptionById(optionId: string) {
    return this.options.get(optionId) ?? null;
  }

  async upsertAuthenticationPolicy(electionId: string, input: any) {
    const policy = {
      electionId,
      method: input.method,
      isEnabled: input.isEnabled ?? true,
      isPaidMethod: input.isPaidMethod,
      provider: input.provider ?? null,
      securityLevel: input.securityLevel,
      identifierFields: input.identifierFields,
      codeChannel: input.codeChannel,
      codeTtlMinutes: input.codeTtlMinutes,
      maxCodeResends: input.maxCodeResends
    };
    this.policies.set(electionId, policy);
    return policy;
  }

  async findAuthenticationPolicy(electionId: string) {
    const policy = this.policies.get(electionId);
    return policy
      ? {
          electionId,
          method: policy.method,
          isEnabled: policy.isEnabled,
          isPaidMethod: policy.isPaidMethod,
          provider: policy.provider
        }
      : null;
  }

  async createOrGetVoterRegistry(electionId: string, sourceType: string) {
    const existing = this.registries.get(electionId);
    if (existing) return existing;
    const registry = {
      id: this.id("registry"),
      electionId,
      status: "draft",
      sourceType,
      totalRows: 0,
      validRows: 0
    };
    this.registries.set(electionId, registry);
    return registry;
  }

  async findVoterRegistryByElectionId(electionId: string) {
    return this.registries.get(electionId) ?? null;
  }

  async createVoterRegistryImport(input: any) {
    const record = { id: this.id("import"), ...input };
    this.imports.set(record.id, record);
    return record;
  }

  async updateVoterRegistryCounts(input: any) {
    const registry = [...this.registries.values()].find((candidate) => candidate.id === input.voterRegistryId)!;
    this.registries.set(registry.electionId, { ...registry, ...input });
  }

  async findEligibleVoterByExternalIdentifierHmac(electionId: string, externalIdentifierHmac: string) {
    return (
      [...this.voters.values()].find(
        (voter) => voter.electionId === electionId && voter.externalIdentifierHmac === externalIdentifierHmac
      ) ?? null
    );
  }

  async createEligibleVoter(input: EligibleVoterCreateInput): Promise<EligibleVoterRecord> {
    const voter = { id: this.id("eligible-voter"), status: "active" as const, ...input };
    this.voters.set(voter.id, voter);
    return voter;
  }

  async createValidationErrors(errors: ValidationErrorInput[]) {
    this.validationErrors.push(...errors);
  }

  async listEligibleVotersForElection(electionId: string) {
    return [...this.voters.values()].filter((voter) => voter.electionId === electionId && voter.status === "active");
  }

  async findInvitationByEligibleVoterId(electionId: string, eligibleVoterId: string) {
    return (
      [...this.invitations.values()].find(
        (invitation) => invitation.electionId === electionId && invitation.eligibleVoterId === eligibleVoterId
      ) ?? null
    );
  }

  async createInvitation(input: InvitationCreateInput): Promise<InvitationRecord> {
    const invitation = {
      id: this.id("invitation"),
      status: "pending" as const,
      sentAt: null,
      lastSentAt: null,
      sendCount: 0,
      ...input
    };
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async markInvitationSent(input: any) {
    const invitation = this.invitations.get(input.invitationId)!;
    const updated = {
      ...invitation,
      channel: input.channel,
      status: "sent" as const,
      sentAt: input.sentAt,
      lastSentAt: input.sentAt,
      sendCount: invitation.sendCount + 1
    };
    this.invitations.set(input.invitationId, updated);
    return updated;
  }

  async findInvitationByTokenHash(tokenHash: string) {
    const invitation = [...this.invitations.values()].find((candidate) => candidate.inviteTokenHash === tokenHash);
    if (!invitation) return null;
    return {
      id: invitation.id,
      electionId: invitation.electionId,
      eligibleVoterId: invitation.eligibleVoterId,
      votingCredentialId: this.findCredentialByVoter(invitation.electionId, invitation.eligibleVoterId)?.id ?? "missing",
      inviteTokenHash: invitation.inviteTokenHash,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      authenticationMethod: this.policies.get(invitation.electionId)?.method ?? AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
    };
  }

  findCredentialByVoter(electionId: string, eligibleVoterId: string) {
    return [...this.credentials.values()].find(
      (credential) => credential.electionId === electionId && credential.eligibleVoterId === eligibleVoterId
    );
  }

  async findVotingCredential(id: string) {
    const credential = this.credentials.get(id);
    if (!credential) return null;
    const voter = this.voters.get(credential.eligibleVoterId);
    return {
      ...credential,
      identifierFailedAttempts: credential.identifierFailedAttempts ?? 0,
      externalIdentifierHmac: voter?.externalIdentifierHmac,
      hasVoted: credential.hasVoted ?? false,
      submissionCount: credential.submissionCount ?? 0,
      lastVoteConfirmedAt: credential.lastVoteConfirmedAt
    };
  }

  async findVotingCredentialByEligibleVoterId(electionId: string, eligibleVoterId: string) {
    return this.findCredentialByVoter(electionId, eligibleVoterId) ?? null;
  }

  async createVotingCredential(input: VotingCredentialCreateInput) {
    const credential = {
      id: this.id("credential"),
      hasVoted: false,
      submissionCount: 0,
      identifierFailedAttempts: 0,
      ...input
    };
    this.credentials.set(credential.id, credential);
    return credential;
  }

  async updateVotingCredential(command: any) {
    const credential = this.credentials.get(command.votingCredentialId)!;
    this.credentials.set(command.votingCredentialId, { ...credential, ...command });
  }

  async updateVotingCredentialParticipation(input: any) {
    const credential = this.credentials.get(input.votingCredentialId)!;
    this.credentials.set(input.votingCredentialId, {
      ...credential,
      hasVoted: input.hasVoted,
      lastVoteConfirmedAt: input.lastVoteConfirmedAt,
      submissionCount: credential.submissionCount + (input.incrementSubmissionCount ? 1 : 0)
    });
  }

  async recordCredentialEvent(event: CredentialEventInput) {
    this.credentialEvents.push(event);
  }

  async recordDeliveryEvent(input: DeliveryEventInput) {
    this.deliveryEvents.push(input);
  }

  async recordElectionStateHistory(input: ElectionStateHistoryInput) {
    this.stateHistories.push(input);
  }

  async recordElectionChangeHistory(input: ElectionChangeHistoryInput) {
    this.changeHistories.push(input);
  }

  async storeVoterSession(session: VoterSessionRecord) {
    this.sessions.set(session.opaqueHandleHash, session);
  }

  async createVoterSessionRecord(session: VoterSessionRecord) {
    await this.storeVoterSession(session);
  }

  async findVoterSessionByHandleHash(handleHash: string, at = now) {
    const session = this.sessions.get(handleHash);
    if (!session || session.revokedAt || session.expiresAt <= at) return null;
    return session;
  }

  async updateVoterSessionAuthentication(command: VoterSessionAuthenticationCommand) {
    const existing = this.sessions.get(command.handleHash);
    if (existing) {
      this.sessions.set(command.handleHash, {
        ...existing,
        authenticated: command.authenticated
      });
    }
  }

  async revokeVoterSession(handleHash: string, revokedAt = now) {
    const existing = this.sessions.get(handleHash);
    if (existing) this.sessions.set(handleHash, { ...existing, revokedAt });
  }

  async touchVoterSession() {}

  async listQuestionsWithOptions(electionId: string): Promise<QuestionWithOptionsRecord[]> {
    return [...this.questions.values()]
      .filter((question) => question.electionId === electionId && question.status === "active")
      .map((question) => ({
        id: question.id,
        title: question.title,
        description: question.description,
        questionType: question.questionType,
        required: question.required,
        minSelect: question.minSelect,
        maxSelect: question.maxSelect,
        displayOrder: question.displayOrder,
        status: question.status,
        options: [...this.options.values()]
          .filter((option) => option.questionId === question.id && option.status === "active")
          .map((option) => ({
            id: option.id,
            label: option.label,
            description: option.description,
            displayOrder: option.displayOrder,
            status: option.status
          }))
      }));
  }

  async findAnonymousVotingPassByCredential(electionId: string, votingCredentialId: string) {
    return this.passes.get(`${electionId}:${votingCredentialId}`) ?? null;
  }

  async createAnonymousVotingPass(input: any) {
    const pass = {
      id: this.id("pass"),
      electionId: input.electionId,
      votingCredentialId: input.votingCredentialId,
      passStatus: "issued" as const,
      usageCount: 0
    };
    this.passes.set(`${input.electionId}:${input.votingCredentialId}`, pass);
    return pass;
  }

  async markAnonymousVotingPassUsed(input: any) {
    const entry = [...this.passes.entries()].find(([, pass]) => pass.id === input.passId)!;
    const updated = { ...entry[1], passStatus: "used" as const, usedAt: input.usedAt, usageCount: entry[1].usageCount + 1 };
    this.passes.set(entry[0], updated);
    return updated;
  }

  async findAnonymousBallotGroupByTokenHash(_electionId: string, tokenHash: string) {
    return this.groups.get(tokenHash) ?? null;
  }

  async createAnonymousBallotGroup(input: any) {
    const group = {
      id: this.id("group"),
      electionId: input.electionId,
      ballotGroupTokenHash: input.tokenHash,
      currentBallotId: null,
      submissionCount: 0
    };
    this.groups.set(input.tokenHash, group);
    return group;
  }

  async submitBallotTransaction(input: any): Promise<SubmitBallotTransactionResult> {
    let supersededBallotIds: string[] = [];
    if (input.accepted) {
      supersededBallotIds = this.ballots
        .filter((ballot) => ballot.anonymousBallotGroupId === input.ballot.anonymousBallotGroupId && ballot.isCurrent)
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
      ...input.ballot.votes.map((vote: any) => ({
        ballotId: ballot.id,
        questionId: vote.questionId,
        optionIds: vote.optionIds,
        hasFreeText: Boolean(vote.freeTextEncrypted)
      }))
    );
    this.submissionEvents.push(...input.submissionEvents.map((event: any) => ({ ...event, ballotId: ballot.id })));
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
        (candidate) => candidate.anonymousBallotGroupId === input.ballot.anonymousBallotGroupId && candidate.isCurrent
      ).length
    };
  }

  async recordSubmissionEvent(input: SubmissionEventInput) {
    this.submissionEvents.push(input);
  }

  async countEligibleVoters(electionId: string) {
    return [...this.voters.values()].filter((voter) => voter.electionId === electionId && voter.status === "active").length;
  }

  async listBallotsForTally(electionId: string) {
    const election = this.elections.get(electionId)!;
    return getTallyEligibleBallots(this.ballots, election).map((ballot) => ({
      id: ballot.id,
      electionId: ballot.electionId,
      isCurrent: ballot.isCurrent,
      acceptanceStatus: ballot.acceptanceStatus,
      serverReceivedAt: ballot.serverReceivedAt,
      votes: this.votes
        .filter((vote) => vote.ballotId === ballot.id)
        .map((vote) => ({
          id: `vote-for-${vote.ballotId}`,
          questionId: vote.questionId,
          answerType: "option" as const,
          optionIds: vote.optionIds,
          hasFreeText: vote.hasFreeText
        }))
    }));
  }

  async createTalliedResult(input: any) {
    const result: ResultRecord = {
      id: this.id("result"),
      electionId: input.electionId,
      status: "tallied",
      talliedAt: input.talliedAt,
      talliedById: input.talliedById,
      sourceRule: input.sourceRule,
      items: input.items.map((item: ResultItemInput) => ({
        id: this.id("result-item"),
        resultId: "pending",
        questionId: item.questionId,
        optionId: item.optionId,
        voteCount: item.voteCount,
        masked: item.masked ?? false,
        displayLabel: item.displayLabel
      }))
    };
    result.items.forEach((item: any) => {
      item.resultId = result.id;
    });
    this.results.push(result);
    return result;
  }

  async findLatestResult(electionId: string) {
    return [...this.results].reverse().find((result) => result.electionId === electionId) ?? null;
  }

  async findResultById(resultId: string) {
    return this.results.find((result) => result.id === resultId) ?? null;
  }

  async createResultVersion(input: any) {
    const version = {
      id: this.id("result-version"),
      electionId: input.electionId,
      resultId: input.resultId,
      versionNo: this.versions.filter((version) => version.electionId === input.electionId).length + 1,
      versionType: input.versionType,
      status: input.status,
      confirmedById: input.confirmedById,
      publishedAt: null,
      notice: input.notice
    };
    this.versions.push(version);
    return version;
  }

  async findLatestResultVersion(electionId: string) {
    return [...this.versions].reverse().find((version) => version.electionId === electionId) ?? null;
  }

  async findPublishedResultVersion(electionId: string) {
    return [...this.versions].reverse().find((version) => version.electionId === electionId && version.status === "published") ?? null;
  }

  async markResultVersionPublished(resultVersionId: string, publishedAt: Date, notice?: string) {
    const index = this.versions.findIndex((version) => version.id === resultVersionId);
    this.versions[index] = { ...this.versions[index], status: "published", publishedAt, notice: notice ?? this.versions[index].notice };
    return this.versions[index];
  }

  async createCorrectionRequest(input: any) {
    const correction = { id: this.id("correction"), status: "requested", approvedById: null, approvedAt: null, ...input };
    this.corrections.push(correction);
    return correction;
  }

  async findCorrectionRequest(correctionId: string) {
    return this.corrections.find((correction) => correction.id === correctionId) ?? null;
  }

  async approveCorrectionRequest(input: any) {
    const index = this.corrections.findIndex((correction) => correction.id === input.correctionId);
    this.corrections[index] = { ...this.corrections[index], status: "approved", approvedById: input.approvedById, approvedAt: input.approvedAt };
    return this.corrections[index];
  }

  async createInvalidationRecord(input: any) {
    const invalidation = { id: this.id("invalidation"), ...input };
    this.invalidations.push(invalidation);
    return invalidation;
  }

  async findReport(reportId: string) {
    return this.reports.find((report) => report.id === reportId) ?? null;
  }

  async createReportForResultVersion(input: any) {
    const report = { id: this.id("report"), status: "requested" as const, ...input };
    this.reports.push(report);
    return report;
  }

  async createReportExport(input: any) {
    const exportRecord = {
      id: this.id("export"),
      status: "requested" as const,
      approvedById: null,
      watermarkId: this.id("watermark"),
      downloadedAt: null,
      ...input
    };
    this.exports.push(exportRecord);
    return exportRecord;
  }

  async findReportExport(exportId: string) {
    return this.exports.find((exportRecord) => exportRecord.id === exportId) ?? null;
  }

  async markReportExportDownloaded(exportId: string, downloadedAt: Date) {
    const index = this.exports.findIndex((exportRecord) => exportRecord.id === exportId);
    this.exports[index] = { ...this.exports[index], status: "downloaded", downloadedAt };
    return this.exports[index];
  }
}

async function prepareAdminElection(repository: MvpFlowRepository, auditRecorder: InMemoryAuditRecorder) {
  const context = adminContext(repository, auditRecorder);
  const { election, authenticationPolicy } = await createElectionDraft(draftInput(), context);
  const question = await createQuestion(
    election.id,
    { title: "Choose one", questionType: "single_choice", required: true, displayOrder: 1 },
    context
  );
  const optionA = await createOption(election.id, question.id, { label: "A", displayOrder: 1 }, context);
  const optionB = await createOption(election.id, question.id, { label: "B", displayOrder: 2 }, context);
  await importEligibleVoters(
    election.id,
    {
      sourceType: "manual",
      rows: [{ name: "Alice", externalIdentifier: "member-001" }],
      reason: "initial registry"
    },
    context
  );
  await requestElectionReview(election.id, { reason: "ready" }, context);
  await approveElectionReview(election.id, { reason: "approved" }, context);
  await scheduleElection(election.id, {}, context);
  await prepareInvitationsForElection(election.id, { reason: "prepare invitations" }, context);
  const firstInvitation = [...repository.invitations.values()][0];
  repository.invitations.set(firstInvitation.id, {
    ...firstInvitation,
    inviteTokenHash: hashInviteToken(inviteToken, hmacKey)
  });
  await issueInvitations(election.id, { reason: "send invitations" }, context);
  await openElection(election.id, { reason: "start" }, context);
  return { electionId: election.id, authenticationPolicy, question, optionA, optionB };
}

describe("MVP end-to-end flow with in-memory boundaries", () => {
  it("connects admin setup, voter auth, anonymous revote, result publication, and public result lookup", async () => {
    const repository = new MvpFlowRepository();
    const auditRecorder = new InMemoryAuditRecorder();
    const { electionId, authenticationPolicy, question, optionA, optionB } = await prepareAdminElection(repository, auditRecorder);

    expect(authenticationPolicy.method).toBe(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER);
    const invite = await verifyInvitationToken({ inviteToken, hmacKey, repository, now });
    const sessionHash = invite.voterSession.opaqueHandleHash;
    const identifier = await verifyVoterIdentifier({
      voterSession: {
        votingCredentialId: invite.voterSession.votingCredentialId,
        authenticationMethod: invite.authenticationMethod
      },
      identifier: "member-001",
      hmacKey,
      repository,
      now
    });
    await repository.updateVoterSessionAuthentication({
      handleHash: sessionHash,
      authenticated: identifier.authenticated,
      identifierVerifiedAt: now,
      step: "authenticated"
    });

    const voterContext = { voterSessionHandle: invite.opaqueHandle, hmacKey, now };
    const electionInfo = await getVoterElectionInfo(repository, voterContext);
    expect(electionInfo).toMatchObject({ voting_mode: "anonymous", state: ElectionState.OPEN });

    const first = await submitAnonymousBallot(
      repository,
      { answers: [{ questionId: question.id, optionIds: [optionA.id] }] },
      voterContext
    );
    await expect(
      submitRevote(
        repository,
        { answers: [{ questionId: question.id, optionIds: [optionB.id] }] },
        { ...voterContext, ballotGroupToken: first.ballotGroupCookie!.value, now: new Date("2026-01-01T00:05:00.000Z") }
      )
    ).rejects.toThrow(/다시 수정할 수 없습니다/);
    expect(first.response.current_ballot_replaced).toBe(false);
    expect(repository.ballots.filter((ballot) => ballot.isCurrent)).toHaveLength(1);
    expect(JSON.stringify([...repository.groups.values()])).not.toContain(invite.voterSession.eligibleVoterId);
    expect(JSON.stringify([...repository.groups.values()])).not.toContain(invite.voterSession.votingCredentialId);

    await closeElection(electionId, { reason: "close" }, adminContext(repository, auditRecorder));
    const resultContextValue = resultContext(repository, auditRecorder);
    const tally = await tallyElectionResult(electionId, {}, resultContextValue);
    await confirmResult(electionId, { reason: "confirmed" }, resultContextValue);
    const published = await publishResult(electionId, { reason: "published", notice: "official" }, resultContextValue);
    const publicResult = await getPublicElectionResult(electionId, { repository, now });
    const completion = await getVoterCompletionStatus(repository, voterContext);

    expect(tally.tally_eligible_ballot_count).toBe(1);
    expect(published.result_version.status).toBe("published");
    expect(publicResult.result_version.status).toBe("published");
    expect(publicResult.result_version.notice).toBe("official");
    expect(completion).toMatchObject({ completed: true });
    const serializedPublicResult = JSON.stringify(publicResult);
    expect(serializedPublicResult).not.toContain("ballot");
    expect(serializedPublicResult).not.toContain("vote-for");
    expect(serializedPublicResult).not.toContain("anonymousBallotGroup");
    expect(serializedPublicResult).not.toContain("ballotGroupTokenHash");
  });
});

describe("operational exception and audit coverage regression", () => {
  it("keeps blocked operation and published-result guardrails intact", async () => {
    const repository = new MvpFlowRepository();
    const auditRecorder = new InMemoryAuditRecorder();
    const context = adminContext(repository, auditRecorder);
    const { election } = await createElectionDraft(draftInput(), context);
    const question = await createQuestion(election.id, { title: "Q", questionType: "single_choice", required: true, displayOrder: 1 }, context);
    await importEligibleVoters(
      election.id,
      {
        sourceType: "manual",
        rows: [{ householdNumber: "7", name: "Alice", identifierLast4: "0001", birthDate6: "900101" }],
        reason: "initial registry"
      },
      context
    );

    const opened = await openElection(election.id, { reason: "start now" }, context);
    expect(opened.state).toBe(ElectionState.OPEN);
    await expect(updateOption(election.id, question.id, "missing-option", { label: "blocked" }, context)).rejects.toThrow();

    expect(canOverwritePublishedResult()).toBe(false);
    expect(PERMISSION_BY_CODE["log.export.download"]?.dualApproval).toBe(ControlRequirement.YES);
    await expect(requestOneTimeCode(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER)).rejects.toThrow(/권한/);
  });

  it("covers core audit and event boundaries without storing sensitive plaintext", async () => {
    const repository = new MvpFlowRepository();
    const auditRecorder = new InMemoryAuditRecorder();
    const { electionId } = await prepareAdminElection(repository, auditRecorder);
    await closeElection(electionId, { reason: "close" }, adminContext(repository, auditRecorder));
    const resultContextValue = resultContext(repository, auditRecorder);
    await tallyElectionResult(electionId, {}, resultContextValue);
    await confirmResult(electionId, { reason: "confirm" }, resultContextValue);
    await publishResult(electionId, { reason: "publish" }, resultContextValue);
    const correction = await requestCorrection(electionId, { reason: "correct" }, resultContextValue);
    await approveCorrection(electionId, correction.correction_request.id, { reason: "approve correction" }, resultContextValue);
    await invalidateElectionResult(electionId, { reason: "invalidate", notice: "void" }, resultContextValue);
    const report = await repository.createReportForResultVersion({
      electionId,
      resultVersionId: repository.versions[0].id,
      reportType: "result_summary",
      format: "pdf",
      generatedById: resultContextValue.session.userId
    });
    const exportRequest = await createReportExportRequest(report.id, { purpose: "archive", format: "pdf" }, resultContextValue);
    repository.exports[0] = { ...repository.exports[0], status: "approved" };
    await getReportExportDownloadInfo(exportRequest.export_request.id, resultContextValue);

    const auditEventTypes = auditRecorder.events.map((event) => event.eventType);
    expect(auditEventTypes).toEqual(
      expect.arrayContaining([
        "election.created",
        "question.created",
        "option.created",
        "voter_registry.imported",
        "election.review_requested",
        "election.approved",
        "election.scheduled",
        "invitation.prepared",
        "invitation.sent",
        "election.opened",
        "election.closed",
        "result.tallied",
        "result.confirmed",
        "result.published",
        "result.correction_requested",
        "result.correction_approved",
        "election.invalidated",
        "report.export_requested",
        "report.export_downloaded"
      ])
    );

    const serializedEvents = JSON.stringify({
      audit: auditRecorder.events,
      credential: repository.credentialEvents,
      submission: repository.submissionEvents
    });
    expect(serializedEvents).not.toContain(inviteToken);
    expect(serializedEvents).not.toContain(voterSessionHandle);
    expect(serializedEvents).not.toContain("member-001");
    expect(serializedEvents).not.toContain("Alice");
  });
});

describe("privacy and UI smoke regression", () => {
  it("keeps service responses and UI demo data free of linkage-oriented internal identifiers", async () => {
    const repository = new MvpFlowRepository();
    const auditRecorder = new InMemoryAuditRecorder();
    const { electionId, question, optionA } = await prepareAdminElection(repository, auditRecorder);
    const invite = await verifyInvitationToken({ inviteToken, hmacKey, repository, now });
    await repository.updateVoterSessionAuthentication({
      handleHash: invite.voterSession.opaqueHandleHash,
      authenticated: true,
      identifierVerifiedAt: now,
      step: "authenticated"
    });
    await submitAnonymousBallot(
      repository,
      { answers: [{ questionId: question.id, optionIds: [optionA.id] }] },
      { voterSessionHandle: invite.opaqueHandle, hmacKey, now }
    );
    await closeElection(electionId, { reason: "close" }, adminContext(repository, auditRecorder));
    const resultContextValue = resultContext(repository, auditRecorder);
    await tallyElectionResult(electionId, {}, resultContextValue);
    await confirmResult(electionId, { reason: "confirm" }, resultContextValue);
    await publishResult(electionId, { reason: "publish" }, resultContextValue);
    const publicResult = await getPublicElectionResult(electionId, { repository, now });
    const report = await repository.createReportForResultVersion({
      electionId,
      resultVersionId: repository.versions[0].id,
      reportType: "result_summary",
      format: "pdf",
      generatedById: resultContextValue.session.userId
    });
    const exportRequest = await createReportExportRequest(report.id, { purpose: "archive", format: "pdf" }, resultContextValue);

    const serialized = JSON.stringify({
      completion: await getVoterCompletionStatus(repository, { voterSessionHandle: invite.opaqueHandle, hmacKey, now }),
      electionInfo: await getVoterElectionInfo(repository, { voterSessionHandle: invite.opaqueHandle, hmacKey, now }),
      publicResult,
      exportRequest,
      uiDemo: demoElections
    });
    for (const forbidden of [
      "ballotGroupTokenHash",
      "anonymousBallotGroupId",
      "votingCredentialId",
      "eligibleVoterId",
      "sessionToken",
      "inviteToken",
      "User-Agent",
      "ipAddress"
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("allows small anonymous result counts for election outcome visibility", () => {
    const evaluation = evaluateAnonymousResultPrivacyRisk({
      votingMode: "anonymous",
      eligibleVoterCount: 8,
      items: [{ questionId: "q", optionId: "o", voteCount: 8 }]
    });
    expect(evaluation.canPublishCounts).toBe(true);
    expect(evaluation.requiredAction).toBe("none");
  });
});
