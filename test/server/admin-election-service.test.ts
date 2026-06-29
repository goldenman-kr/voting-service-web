import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { AuthenticationMethod, ElectionState, Role } from "../../src/guardrails/index.js";
import { InMemoryAuditRecorder } from "../../src/server/audit/audit-event";
import { createMockAdminSession } from "../../src/server/auth/admin-session";
import {
  configureAuthenticationPolicy,
  approveElectionReview,
  closeElection,
  createElectionDraft,
  createOption,
  createQuestion,
  issueInvitations,
  importEligibleVoters,
  openElection,
  pauseElection,
  prepareInvitationsForElection,
  requestElectionReview,
  resendInvitation,
  resumeElection,
  scheduleElection,
  updateOption
} from "../../src/server/elections/election-service";
import {
  handleApproveElectionRoute,
  handleCreateElectionRoute,
  type AdminElectionRouteDependencies
} from "../../src/server/elections/route-handlers";
import type {
  AuthenticationPolicyRecord,
  ElectionRecord,
  ElectionRepository,
  EligibleVoterCreateInput,
  EligibleVoterRecord,
  ElectionChangeHistoryInput,
  ElectionStateHistoryInput,
  InvitationCreateInput,
  InvitationRecord,
  ImportStatusValue,
  NotificationChannelValue,
  OptionRecord,
  QuestionRecord,
  RegistryStatusValue,
  ValidationErrorInput,
  VotingCredentialCreateInput,
  VotingCredentialRecord,
  DeliveryEventInput,
  VoterRegistryImportRecord,
  VoterRegistryRecord
} from "../../src/server/elections/repository";
import type {
  AuthenticationPolicyInput,
  ElectionDraftInput,
  ElectionDraftUpdateInput,
  OptionInput,
  OptionUpdateInput,
  QuestionInput,
  QuestionUpdateInput
} from "../../src/server/elections/validation";

const hmacKey = "admin-election-test-hmac-key-32-chars";
const now = new Date("2026-01-01T00:00:00.000Z");

class InMemoryElectionRepository implements ElectionRepository {
  elections = new Map<string, ElectionRecord>();
  questions = new Map<string, QuestionRecord>();
  options = new Map<string, OptionRecord>();
  policies = new Map<string, AuthenticationPolicyRecord>();
  registries = new Map<string, VoterRegistryRecord>();
  imports = new Map<string, VoterRegistryImportRecord>();
  voters = new Map<string, EligibleVoterRecord>();
  invitations = new Map<string, InvitationRecord>();
  credentials = new Map<string, VotingCredentialRecord>();
  deliveryEvents: DeliveryEventInput[] = [];
  validationErrors: ValidationErrorInput[] = [];
  stateHistories: ElectionStateHistoryInput[] = [];
  changeHistories: ElectionChangeHistoryInput[] = [];
  private sequence = 1;

  id(prefix: string) {
    return `${prefix}-${this.sequence++}`;
  }

  async createElectionDraft(
    input: ElectionDraftInput & { organizationId: string; createdById: string }
  ) {
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
    return this.elections.get(electionId) ?? null;
  }

  async listElections(organizationId: string) {
    return [...this.elections.values()].filter(
      (election) => election.organizationId === organizationId
    );
  }

  async updateElectionDraft(electionId: string, input: ElectionDraftUpdateInput) {
    const election = this.elections.get(electionId)!;
    const updated = { ...election, ...input };
    this.elections.set(electionId, updated);
    return updated;
  }

  async updateElectionState(electionId: string, state: string) {
    const election = this.elections.get(electionId)!;
    this.elections.set(electionId, { ...election, state: state as ElectionRecord["state"] });
  }

  async createQuestion(electionId: string, input: QuestionInput) {
    const question: QuestionRecord = {
      id: this.id("question"),
      electionId,
      title: input.title,
      description: input.description,
      questionType: input.questionType,
      required: input.required,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
      displayOrder: input.displayOrder,
      status: "active"
    };
    this.questions.set(question.id, question);
    return question;
  }

  async updateQuestion(questionId: string, input: QuestionUpdateInput) {
    const question = this.questions.get(questionId)!;
    const updated = { ...question, ...input };
    this.questions.set(questionId, updated);
    return updated;
  }

  async createOption(questionId: string, input: OptionInput) {
    const option: OptionRecord = {
      id: this.id("option"),
      questionId,
      label: input.label,
      description: input.description,
      displayOrder: input.displayOrder,
      status: "active"
    };
    this.options.set(option.id, option);
    return option;
  }

  async updateOption(optionId: string, input: OptionUpdateInput) {
    const option = this.options.get(optionId)!;
    const updated = { ...option, ...input };
    this.options.set(optionId, updated);
    return updated;
  }

  async findQuestionById(questionId: string) {
    return this.questions.get(questionId) ?? null;
  }

  async findOptionById(optionId: string) {
    return this.options.get(optionId) ?? null;
  }

  async upsertAuthenticationPolicy(
    electionId: string,
    input: AuthenticationPolicyInput & { isPaidMethod: boolean; securityLevel: string }
  ) {
    const policy: AuthenticationPolicyRecord = {
      electionId,
      method: input.method as AuthenticationPolicyRecord["method"],
      isEnabled: input.isEnabled ?? true,
      isPaidMethod: input.isPaidMethod,
      provider: input.provider,
      securityLevel: input.securityLevel,
      identifierFields: input.identifierFields,
      codeChannel: input.codeChannel,
      codeTtlMinutes: input.codeTtlMinutes,
      maxCodeResends: input.maxCodeResends
    };
    this.policies.set(electionId, policy);
    return policy;
  }

  async createOrGetVoterRegistry(electionId: string, sourceType: string) {
    const existing = this.registries.get(electionId);
    if (existing) {
      return existing;
    }
    const registry: VoterRegistryRecord = {
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

  async createVoterRegistryImport(input: {
    voterRegistryId: string;
    fileName?: string;
    fileHash?: string;
    rowCount: number;
    importStatus: ImportStatusValue;
  }) {
    const record: VoterRegistryImportRecord = {
      id: this.id("import"),
      voterRegistryId: input.voterRegistryId,
      importStatus: input.importStatus,
      rowCount: input.rowCount
    };
    this.imports.set(record.id, record);
    return record;
  }

  async updateVoterRegistryCounts(input: {
    voterRegistryId: string;
    status: RegistryStatusValue;
    totalRows: number;
    validRows: number;
  }) {
    const registry = [...this.registries.values()].find(
      (candidate) => candidate.id === input.voterRegistryId
    )!;
    this.registries.set(registry.electionId, {
      ...registry,
      status: input.status,
      totalRows: input.totalRows,
      validRows: input.validRows
    });
  }

  async findEligibleVoterByExternalIdentifierHmac(
    electionId: string,
    externalIdentifierHmac: string
  ) {
    return (
      [...this.voters.values()].find(
        (voter) =>
          voter.electionId === electionId &&
          voter.externalIdentifierHmac === externalIdentifierHmac
      ) ?? null
    );
  }

  async createEligibleVoter(input: EligibleVoterCreateInput) {
    const voter: EligibleVoterRecord = {
      id: this.id("eligible-voter"),
      status: "active",
      ...input
    };
    this.voters.set(voter.id, voter);
    return voter;
  }

  async createValidationErrors(errors: ValidationErrorInput[]) {
    this.validationErrors.push(...errors);
  }

  async listEligibleVotersForElection(electionId: string) {
    return [...this.voters.values()].filter(
      (voter) => voter.electionId === electionId && voter.status === "active"
    );
  }

  async findInvitationByEligibleVoterId(electionId: string, eligibleVoterId: string) {
    return (
      [...this.invitations.values()].find(
        (invitation) =>
          invitation.electionId === electionId && invitation.eligibleVoterId === eligibleVoterId
      ) ?? null
    );
  }

  async createInvitation(input: InvitationCreateInput) {
    const invitation: InvitationRecord = {
      id: this.id("invitation"),
      status: "pending",
      sentAt: null,
      lastSentAt: null,
      sendCount: 0,
      ...input
    };
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async markInvitationSent(input: {
    invitationId: string;
    channel: NotificationChannelValue;
    sentAt: Date;
  }) {
    const invitation = this.invitations.get(input.invitationId)!;
    const updated: InvitationRecord = {
      ...invitation,
      channel: input.channel,
      status: "sent",
      sentAt: input.sentAt,
      lastSentAt: input.sentAt,
      sendCount: invitation.sendCount + 1
    };
    this.invitations.set(input.invitationId, updated);
    return updated;
  }

  async findVotingCredentialByEligibleVoterId(electionId: string, eligibleVoterId: string) {
    return (
      [...this.credentials.values()].find(
        (credential) =>
          credential.electionId === electionId && credential.eligibleVoterId === eligibleVoterId
      ) ?? null
    );
  }

  async createVotingCredential(input: VotingCredentialCreateInput) {
    const credential: VotingCredentialRecord = {
      id: this.id("credential"),
      ...input
    };
    this.credentials.set(credential.id, credential);
    return credential;
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
}

function createContext(
  repository = new InMemoryElectionRepository(),
  overrides: Partial<AdminElectionRouteDependencies> = {}
) {
  return {
    session: createMockAdminSession({ roles: [Role.ELECTION_MANAGER] }),
    repository,
    auditRecorder: new InMemoryAuditRecorder(),
    hmacKey,
    now,
    ...overrides
  };
}

function createStepUpContext(
  repository = new InMemoryElectionRepository(),
  roles: string[] = [Role.ELECTION_MANAGER, Role.ELECTION_APPROVER],
  permissions?: string[]
) {
  const nowDate = now;
  return createContext(repository, {
    session: createMockAdminSession({
      roles,
      permissions,
      stepUp: {
        verifiedAt: nowDate,
        expiresAt: new Date("2026-01-01T00:15:00.000Z")
      }
    })
  });
}

function draftInput() {
  return {
    title: "Board Election",
    electionType: "representative_election",
    votingMode: "anonymous",
    startsAt: "2026-02-01T00:00:00.000Z",
    endsAt: "2026-02-02T00:00:00.000Z",
    timezone: "Asia/Seoul"
  };
}

describe("admin election service", () => {
  it("rejects election creation without permission", async () => {
    const context = createContext(new InMemoryElectionRepository(), {
      session: createMockAdminSession({ roles: [], permissions: [] })
    });

    await expect(createElectionDraft(draftInput(), context)).rejects.toThrow(/권한/);
  });

  it("lets ElectionManager create Draft with default AuthenticationPolicy", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createContext(repository);

    const result = await createElectionDraft(draftInput(), context);

    expect(result.election.state).toBe(ElectionState.DRAFT);
    expect(result.authenticationPolicy.method).toBe(
      AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
    );
    expect(repository.policies.get(result.election.id)?.method).toBe(
      AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
    );
  });

  it("allows Question and Option edits in Draft", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createContext(repository);
    const { election } = await createElectionDraft(draftInput(), context);

    const question = await createQuestion(
      election.id,
      {
        title: "Choose one",
        questionType: "single_choice",
        required: true,
        displayOrder: 1
      },
      context
    );
    const option = await createOption(
      election.id,
      question.id,
      { label: "A", displayOrder: 1 },
      context
    );
    const updated = await updateOption(
      election.id,
      question.id,
      option.id,
      { label: "B" },
      context
    );

    expect(updated.label).toBe("B");
  });

  it("blocks Question, Option, and registry edits in Open state", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createContext(repository);
    const { election } = await createElectionDraft(draftInput(), context);
    const question = await createQuestion(
      election.id,
      { title: "Q", questionType: "single_choice", required: true, displayOrder: 1 },
      context
    );
    repository.elections.set(election.id, { ...election, state: ElectionState.OPEN });

    await expect(
      createOption(election.id, question.id, { label: "A", displayOrder: 1 }, context)
    ).rejects.toThrow(/현재 투표 상태/);
    await expect(
      importEligibleVoters(
        election.id,
        {
          sourceType: "manual",
          rows: [{ name: "Kim", externalIdentifier: "M001" }]
        },
        context
      )
    ).rejects.toThrow(/현재 투표 상태/);
  });

  it("ignores code settings for non-code AuthenticationPolicy methods", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createContext(repository);
    const { election } = await createElectionDraft(draftInput(), context);

    const policy = await configureAuthenticationPolicy(
      election.id,
      {
        method: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER,
        codeTtlMinutes: 5,
        maxCodeResends: 3,
        codeChannel: "email",
        reason: "policy setup"
      },
      context
    );

    expect(policy.codeTtlMinutes).toBeUndefined();
    expect(policy.maxCodeResends).toBeUndefined();
    expect(policy.codeChannel).toBeUndefined();
  });

  it("does not enable paid or non-MVP authentication providers", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createContext(repository);
    const { election } = await createElectionDraft(draftInput(), context);

    for (const method of [
      AuthenticationMethod.SMS_CODE,
      AuthenticationMethod.KAKAO_MESSAGE,
      AuthenticationMethod.EXTERNAL_IDENTITY,
      AuthenticationMethod.SSO,
      AuthenticationMethod.LEGAL_STRONG_AUTH
    ]) {
      await expect(
        configureAuthenticationPolicy(election.id, { method, isEnabled: true }, context)
      ).rejects.toThrow(/MVP/);
    }
  });

  it("detects duplicate external identifiers without exposing raw PII", async () => {
    const repository = new InMemoryElectionRepository();
    const auditRecorder = new InMemoryAuditRecorder();
    const context = createContext(repository, { auditRecorder });
    const { election } = await createElectionDraft(draftInput(), context);

    const result = await importEligibleVoters(
      election.id,
      {
        sourceType: "manual",
        rows: [
          { name: "Alice Raw", email: "alice@example.com", externalIdentifier: "MEM-1" },
          { name: "Alice Raw Duplicate", email: "alice2@example.com", externalIdentifier: "MEM-1" }
        ],
        reason: "initial import"
      },
      context
    );

    expect(result.validRows).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(JSON.stringify(repository.validationErrors)).not.toContain("MEM-1");
    expect(JSON.stringify(repository.validationErrors)).not.toContain("Alice Raw");
    expect(JSON.stringify(auditRecorder.events)).not.toContain("alice@example.com");
    expect(JSON.stringify(auditRecorder.events)).not.toContain("MEM-1");
    expect([...repository.voters.values()][0].nameEncrypted).toMatch(/^encrypted:/);
  });

  it("requests review by state transition and audit event", async () => {
    const repository = new InMemoryElectionRepository();
    const auditRecorder = new InMemoryAuditRecorder();
    const context = createContext(repository, { auditRecorder });
    const { election } = await createElectionDraft(draftInput(), context);

    const result = await requestElectionReview(
      election.id,
      { reason: "ready for approval" },
      context
    );

    expect(result.state).toBe(ElectionState.READY_FOR_REVIEW);
    expect(repository.stateHistories[0]).toMatchObject({
      fromState: ElectionState.DRAFT,
      toState: ElectionState.READY_FOR_REVIEW
    });
    expect(auditRecorder.events.some((event) => event.eventType === "election.review_requested")).toBe(
      true
    );
  });

  it("admin route skeleton goes through permission boundary", async () => {
    const repository = new InMemoryElectionRepository();
    const request = new NextRequest("https://example.test/api/v1/admin/elections", {
      method: "POST",
      body: JSON.stringify(draftInput()),
      headers: { "content-type": "application/json" }
    });

    const unauthorized = await handleCreateElectionRoute(request, {
      repository,
      hmacKey,
      now
    });
    expect(unauthorized.status).toBe(401);

    const authorized = await handleCreateElectionRoute(
      new NextRequest("https://example.test/api/v1/admin/elections", {
        method: "POST",
        body: JSON.stringify(draftInput()),
        headers: { "content-type": "application/json" }
      }),
      createContext(repository)
    );
    expect(authorized.status).toBe(200);
  });

  it("allows ReadyForReview to Approved with step-up and reason", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createStepUpContext(repository, [Role.ELECTION_APPROVER]);
    const managerContext = createContext(repository);
    const { election } = await createElectionDraft(draftInput(), managerContext);
    await requestElectionReview(election.id, { reason: "ready" }, managerContext);

    const result = await approveElectionReview(election.id, { reason: "reviewed" }, context);

    expect(result.state).toBe(ElectionState.APPROVED);
    expect(repository.stateHistories.at(-1)).toMatchObject({
      fromState: ElectionState.READY_FOR_REVIEW,
      toState: ElectionState.APPROVED
    });
  });

  it("blocks direct Draft to Open transition", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createStepUpContext(repository, [Role.ELECTION_MANAGER, Role.ELECTION_APPROVER]);
    const { election } = await createElectionDraft(draftInput(), context);

    await expect(openElection(election.id, { reason: "start now" }, context)).rejects.toThrow(
      /현재 투표 상태/
    );
  });

  it("allows Open to Paused to Open and Open or Paused to Closed", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createStepUpContext(repository, [Role.ELECTION_MANAGER, Role.ELECTION_APPROVER]);
    const { election } = await createElectionDraft(draftInput(), context);
    repository.elections.set(election.id, { ...election, state: ElectionState.OPEN });

    await expect(pauseElection(election.id, { reason: "incident" }, context)).resolves.toMatchObject({
      state: ElectionState.PAUSED
    });
    await expect(resumeElection(election.id, { reason: "recovered" }, context)).resolves.toMatchObject({
      state: ElectionState.OPEN
    });
    await expect(closeElection(election.id, { reason: "ended" }, context)).resolves.toMatchObject({
      state: ElectionState.CLOSED
    });

    const { election: second } = await createElectionDraft({ ...draftInput(), title: "Second" }, context);
    repository.elections.set(second.id, { ...second, state: ElectionState.PAUSED });
    await expect(closeElection(second.id, { reason: "ended" }, context)).resolves.toMatchObject({
      state: ElectionState.CLOSED
    });
  });

  it("requires permission, step-up, and reason for protected state transitions", async () => {
    const repository = new InMemoryElectionRepository();
    const managerContext = createContext(repository);
    const { election } = await createElectionDraft(draftInput(), managerContext);
    await requestElectionReview(election.id, { reason: "ready" }, managerContext);

    await expect(
      approveElectionReview(election.id, { reason: "ok" }, managerContext)
    ).rejects.toThrow(/권한/);

    const approverWithoutStepUp = createContext(repository, {
      session: createMockAdminSession({ roles: [Role.ELECTION_APPROVER] })
    });
    await expect(
      approveElectionReview(election.id, { reason: "ok" }, approverWithoutStepUp)
    ).rejects.toThrow(/추가 인증/);

    const approver = createStepUpContext(repository, [Role.ELECTION_APPROVER]);
    await expect(approveElectionReview(election.id, {}, approver)).rejects.toThrow(/입력값/);
  });

  it("schedules and opens through approved transitions only", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createStepUpContext(repository, [Role.ELECTION_APPROVER]);
    const managerContext = createContext(repository);
    const { election } = await createElectionDraft(draftInput(), managerContext);
    await requestElectionReview(election.id, { reason: "ready" }, managerContext);
    await approveElectionReview(election.id, { reason: "reviewed" }, context);

    await expect(scheduleElection(election.id, {}, context)).resolves.toMatchObject({
      state: ElectionState.SCHEDULED
    });
    await expect(openElection(election.id, { reason: "scheduled start" }, context)).resolves.toMatchObject({
      state: ElectionState.OPEN
    });
  });

  it("prepares invitations and credentials without storing raw tokens or code-only credentials", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createStepUpContext(repository, [Role.ELECTION_MANAGER, Role.ELECTION_APPROVER]);
    const { election } = await createElectionDraft(draftInput(), context);
    await importEligibleVoters(
      election.id,
      {
        sourceType: "manual",
        rows: [
          { name: "Alice", externalIdentifier: "M001" },
          { name: "Bob", externalIdentifier: "M002" }
        ],
        reason: "initial import"
      },
      context
    );
    repository.elections.set(election.id, { ...election, state: ElectionState.APPROVED });

    const result = await prepareInvitationsForElection(
      election.id,
      { reason: "prepare invite" },
      context
    );

    expect(result.invitationsCreated).toBe(2);
    expect(result.credentialsCreated).toBe(2);
    expect([...repository.invitations.values()].every((invitation) => invitation.inviteTokenHash.length >= 32)).toBe(
      true
    );
    expect(JSON.stringify(repository.invitations)).not.toContain("invite_token");
    expect([...repository.credentials.values()].every((credential) => credential.authStatus === "not_started")).toBe(
      true
    );
    expect(JSON.stringify(repository.credentials)).not.toContain("ballot");
    expect(JSON.stringify(repository.credentials)).not.toContain("anonymousBallotGroup");
  });

  it("sends or resends invitations only in allowed states", async () => {
    const repository = new InMemoryElectionRepository();
    const context = createStepUpContext(repository, [Role.ELECTION_MANAGER, Role.ELECTION_APPROVER]);
    const { election } = await createElectionDraft(draftInput(), context);
    await importEligibleVoters(
      election.id,
      {
        sourceType: "manual",
        rows: [{ name: "Alice", externalIdentifier: "M001" }],
        reason: "initial import"
      },
      context
    );

    await expect(
      issueInvitations(election.id, { reason: "send invite" }, context)
    ).rejects.toThrow(/현재 투표 상태/);
    repository.elections.set(election.id, { ...election, state: ElectionState.SCHEDULED });
    await expect(issueInvitations(election.id, { reason: "send invite" }, context)).resolves.toMatchObject({
      sentCount: 1
    });
    repository.elections.set(election.id, { ...election, state: ElectionState.OPEN });
    await expect(resendInvitation(election.id, { reason: "resend invite" }, context)).resolves.toMatchObject({
      resentCount: 1
    });
    repository.elections.set(election.id, { ...election, state: ElectionState.PAUSED });
    await expect(resendInvitation(election.id, { reason: "resend while paused" }, context)).resolves.toMatchObject({
      resentCount: 1
    });
    repository.elections.set(election.id, { ...election, state: ElectionState.CLOSED });
    await expect(
      resendInvitation(election.id, { reason: "too late" }, context)
    ).rejects.toThrow(/현재 투표 상태/);
  });

  it("does not place invite token or PII in audit or delivery events", async () => {
    const repository = new InMemoryElectionRepository();
    const auditRecorder = new InMemoryAuditRecorder();
    const context = createStepUpContext(repository, [Role.ELECTION_MANAGER, Role.ELECTION_APPROVER]);
    const scopedContext = { ...context, auditRecorder };
    const { election } = await createElectionDraft(draftInput(), scopedContext);
    await importEligibleVoters(
      election.id,
      {
        sourceType: "manual",
        rows: [{ name: "Sensitive Name", email: "sensitive@example.com", externalIdentifier: "RAW-ID" }],
        reason: "initial import"
      },
      scopedContext
    );
    repository.elections.set(election.id, { ...election, state: ElectionState.SCHEDULED });
    await issueInvitations(election.id, { reason: "send invite" }, scopedContext);

    const logs = JSON.stringify({ audit: auditRecorder.events, delivery: repository.deliveryEvents });
    expect(logs).not.toContain("Sensitive Name");
    expect(logs).not.toContain("sensitive@example.com");
    expect(logs).not.toContain("RAW-ID");
    expect(logs).not.toContain("invite_token");
  });

  it("approve route skeleton goes through permission and step-up boundary", async () => {
    const repository = new InMemoryElectionRepository();
    const managerContext = createContext(repository);
    const { election } = await createElectionDraft(draftInput(), managerContext);
    await requestElectionReview(election.id, { reason: "ready" }, managerContext);

    const request = new NextRequest(`https://example.test/api/v1/admin/elections/${election.id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason: "approved" }),
      headers: { "content-type": "application/json" }
    });

    const unauthorized = await handleApproveElectionRoute(request, election.id, {
      repository,
      hmacKey,
      now
    });
    expect(unauthorized.status).toBe(401);

    const noStepUp = await handleApproveElectionRoute(
      new NextRequest(`https://example.test/api/v1/admin/elections/${election.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ reason: "approved" }),
        headers: { "content-type": "application/json" }
      }),
      election.id,
      createContext(repository, {
        session: createMockAdminSession({ roles: [Role.ELECTION_APPROVER] })
      })
    );
    expect(noStepUp.status).toBe(403);

    const approved = await handleApproveElectionRoute(
      new NextRequest(`https://example.test/api/v1/admin/elections/${election.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ reason: "approved" }),
        headers: { "content-type": "application/json" }
      }),
      election.id,
      createStepUpContext(repository, [Role.ELECTION_APPROVER])
    );
    expect(approved.status).toBe(200);
  });
});
