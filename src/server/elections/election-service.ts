import { createHmac, randomBytes } from "node:crypto";

import {
  getAuthenticationMethodCapabilities,
  getDefaultAuthenticationMethod,
  isAvailableInMvp,
  requiresOneTimeCode,
  type AuthenticationMethodValue
} from "../../domain/auth-policy/authentication-policy";
import { ElectionAction, canPerformElectionAction } from "../../domain/elections/actions";
import {
  assertElectionTransitionAllowed,
  type ElectionStateValue
} from "../../domain/elections/state-machine";
import { PolicyDecision } from "../../domain/policy-decision";
import { ControlRequirement, ElectionState, PERMISSION_BY_CODE } from "../../guardrails/index.js";
import {
  createAuditEventPayload,
  recordAuditEvent,
  type AuditRecorder
} from "../audit/audit-event";
import type { AdminSession } from "../auth/admin-session";
import { ApiError } from "../http/errors";
import { requirePermission, requirePermissionWithStepUp } from "../rbac/authorize";
import { redactSensitiveValues } from "../privacy/redaction";
import type {
  ElectionRecord,
  ElectionRepository,
  InvitationRecord,
  NotificationChannelValue,
  ValidationErrorInput,
  VotingCredentialRecord
} from "./repository";
import {
  authenticationPolicyInputSchema,
  electionDraftInputSchema,
  electionDraftUpdateInputSchema,
  optionInputSchema,
  optionUpdateInputSchema,
  questionInputSchema,
  questionUpdateInputSchema,
  electionTransitionInputSchema,
  invitationPrepareInputSchema,
  invitationResendInputSchema,
  invitationSendInputSchema,
  reviewRequestInputSchema,
  voterRegistryImportInputSchema,
  type AuthenticationPolicyInput,
  type EligibleVoterImportRow
} from "./validation";

export type ElectionServiceContext = Readonly<{
  session: AdminSession;
  repository: ElectionRepository;
  auditRecorder?: AuditRecorder;
  hmacKey: string;
  now?: Date;
}>;

function nowFrom(context: ElectionServiceContext): Date {
  return context.now ?? new Date();
}

function validationError(internalReason: string, details?: Record<string, unknown>) {
  return new ApiError({
    status: 400,
    code: "validation_error",
    userMessage: "입력값을 확인해 주세요.",
    internalReason,
    details: details ? redactSensitiveValues(details) : undefined
  });
}

function conflictError(internalReason: string) {
  return new ApiError({
    status: 409,
    code: "conflict",
    userMessage: "현재 투표 상태에서는 이 작업을 수행할 수 없습니다.",
    internalReason
  });
}

function notFoundError(target: string) {
  return new ApiError({
    status: 404,
    code: "not_found",
    userMessage: "대상을 찾을 수 없습니다.",
    internalReason: `${target} not found`
  });
}

function assertOrganizationScope(session: AdminSession, election: ElectionRecord): void {
  if (session.organizationId && session.organizationId !== election.organizationId) {
    throw notFoundError("election");
  }
}

function assertElectionActionAllowed(
  election: ElectionRecord,
  action: ElectionAction,
  reason?: string
): void {
  const decision = canPerformElectionAction(election.state, action);
  if (decision === PolicyDecision.DENIED) {
    throw conflictError(`${action} denied in ${election.state}`);
  }
  if (decision === PolicyDecision.REQUIRES_REASON && !reason?.trim()) {
    throw validationError(`${action} requires reason`);
  }
}

async function audit(
  context: ElectionServiceContext,
  input: {
    eventType: string;
    targetType: string;
    targetId?: string;
    reason?: string;
    beforeSummary?: Record<string, unknown>;
    afterSummary?: Record<string, unknown>;
  }
): Promise<void> {
  if (!context.auditRecorder) {
    return;
  }
  await recordAuditEvent(
    context.auditRecorder,
    createAuditEventPayload({
      session: context.session,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      beforeSummary: input.beforeSummary,
      afterSummary: input.afterSummary,
      occurredAt: nowFrom(context)
    })
  );
}

async function getScopedElection(
  context: ElectionServiceContext,
  electionId: string
): Promise<ElectionRecord> {
  const election = await context.repository.findElectionById(electionId);
  if (!election) {
    throw notFoundError("election");
  }
  assertOrganizationScope(context.session, election);
  return election;
}

function hmacValue(value: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(value.trim().toLowerCase()).digest("hex");
}

function hmacOpaqueValue(value: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(value).digest("hex");
}

function createStoredTokenHash(hmacKey: string): string {
  return hmacOpaqueValue(randomBytes(32).toString("base64url"), hmacKey);
}

function protectPersonalValue(value: string | undefined, hmacKey: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return `encrypted:${hmacValue(value, hmacKey).slice(0, 32)}`;
}

function normalizeAuthPolicyInput(input: AuthenticationPolicyInput): AuthenticationPolicyInput & {
  method: AuthenticationMethodValue;
  isPaidMethod: boolean;
  securityLevel: string;
} {
  const method = (input.method ?? getDefaultAuthenticationMethod()) as AuthenticationMethodValue;
  const capabilities = getAuthenticationMethodCapabilities(method);
  const isEnabled = input.isEnabled ?? true;

  if (isEnabled && !isAvailableInMvp(method)) {
    throw new ApiError({
      status: 403,
      code: "forbidden",
      userMessage: "현재 MVP에서 사용할 수 없는 인증 방식입니다.",
      internalReason: `${method} is disabled in MVP`
    });
  }

  const codeSettings = requiresOneTimeCode(method)
    ? {
        codeChannel: input.codeChannel,
        codeTtlMinutes: input.codeTtlMinutes,
        maxCodeResends: input.maxCodeResends
      }
    : {
        codeChannel: undefined,
        codeTtlMinutes: undefined,
        maxCodeResends: undefined
      };

  return {
    ...input,
    ...codeSettings,
    method,
    isEnabled,
    isPaidMethod: capabilities.paidMethod,
    securityLevel: capabilities.securityLevel
  };
}

function permissionRequiresReason(permissionCode: string): boolean {
  return PERMISSION_BY_CODE[permissionCode]?.reason === ControlRequirement.YES;
}

function assertPermissionControls(
  context: ElectionServiceContext,
  permissionCode: string,
  reason?: string
): void {
  requirePermissionWithStepUp(context.session, permissionCode, nowFrom(context));
  if (permissionRequiresReason(permissionCode) && !reason?.trim()) {
    throw validationError(`${permissionCode} requires reason`);
  }
}

async function transitionElectionState(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext,
  targetState: ElectionStateValue,
  {
    permissionCode,
    eventType,
    changeType
  }: {
    permissionCode: string;
    eventType: string;
    changeType: string;
  }
) {
  const input = electionTransitionInputSchema.parse(rawInput);
  assertPermissionControls(context, permissionCode, input.reason);
  const election = await getScopedElection(context, electionId);
  try {
    assertElectionTransitionAllowed(election.state, targetState);
  } catch {
    throw conflictError(`transition denied: ${election.state} -> ${targetState}`);
  }
  await context.repository.updateElectionState(electionId, targetState);
  await context.repository.recordElectionStateHistory({
    electionId,
    fromState: election.state,
    toState: targetState,
    requestedById: context.session.userId,
    approvedById: context.session.userId,
    reason: input.reason,
    changeType,
    changedAt: nowFrom(context)
  });
  await audit(context, {
    eventType,
    targetType: "Election",
    targetId: electionId,
    reason: input.reason,
    beforeSummary: { state: election.state },
    afterSummary: { state: targetState }
  });
  return { electionId, state: targetState };
}

function assertInvitationPreparationAllowed(election: ElectionRecord): void {
  const allowedStates: readonly ElectionStateValue[] = [
    ElectionState.APPROVED,
    ElectionState.SCHEDULED,
    ElectionState.NOTICE,
    ElectionState.OPEN,
    ElectionState.PAUSED
  ];
  if (
    !allowedStates.includes(election.state)
  ) {
    throw conflictError(`invitation preparation denied in ${election.state}`);
  }
}

function assertInvitationSendAllowed(election: ElectionRecord, reason?: string): void {
  assertElectionActionAllowed(election, ElectionAction.SEND_INVITATIONS, reason);
  if (election.state === ElectionState.APPROVED) {
    throw conflictError("approved state allows invitation preparation only");
  }
}

async function assertVoterRegistryReady(context: ElectionServiceContext, electionId: string) {
  const registry = await context.repository.findVoterRegistryByElectionId(electionId);
  if (!registry) {
    throw validationError("voter registry is required before invitations");
  }
  if (registry.totalRows === 0 || registry.validRows === 0 || registry.validRows !== registry.totalRows) {
    throw validationError("voter registry must be fully valid before invitations");
  }
  if (!["validated", "confirmed", "locked"].includes(registry.status)) {
    throw validationError(`voter registry status is not ready: ${registry.status}`);
  }
  return registry;
}

async function createInvitationForEligibleVoter(
  context: ElectionServiceContext,
  election: ElectionRecord,
  eligibleVoterId: string,
  channel: NotificationChannelValue
): Promise<{ invitation: InvitationRecord; created: boolean }> {
  const existing = await context.repository.findInvitationByEligibleVoterId(
    election.id,
    eligibleVoterId
  );
  if (existing) {
    return { invitation: existing, created: false };
  }
  const invitation = await context.repository.createInvitation({
    electionId: election.id,
    eligibleVoterId,
    inviteTokenHash: createStoredTokenHash(context.hmacKey),
    channel,
    expiresAt: election.endsAt
  });
  return { invitation, created: true };
}

async function createVotingCredentialForEligibleVoter(
  context: ElectionServiceContext,
  electionId: string,
  eligibleVoterId: string
): Promise<VotingCredentialRecord | null> {
  const existing = await context.repository.findVotingCredentialByEligibleVoterId(
    electionId,
    eligibleVoterId
  );
  if (existing) {
    return null;
  }
  return context.repository.createVotingCredential({
    electionId,
    eligibleVoterId,
    credentialStatus: "active",
    authStatus: "not_started"
  });
}

export async function createElectionDraft(
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "election.create");
  if (!context.session.organizationId) {
    throw validationError("admin session missing organization scope");
  }
  const input = electionDraftInputSchema.parse(rawInput);
  const election = await context.repository.createElectionDraft({
    ...input,
    organizationId: context.session.organizationId,
    createdById: context.session.userId
  });
  const defaultPolicy = await context.repository.upsertAuthenticationPolicy(election.id, {
    method: getDefaultAuthenticationMethod(),
    isEnabled: true,
    isPaidMethod: false,
    securityLevel: "standard"
  });
  await audit(context, {
    eventType: "election.created",
    targetType: "Election",
    targetId: election.id,
    afterSummary: {
      title: election.title,
      state: election.state,
      authenticationMethod: defaultPolicy.method
    }
  });
  return { election, authenticationPolicy: defaultPolicy };
}

export async function listElections(context: ElectionServiceContext) {
  requirePermission(context.session, "election.read");
  if (!context.session.organizationId) {
    throw validationError("admin session missing organization scope");
  }
  return context.repository.listElections(context.session.organizationId);
}

export async function getElection(electionId: string, context: ElectionServiceContext) {
  requirePermission(context.session, "election.read");
  return getScopedElection(context, electionId);
}

export async function updateElectionDraft(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "election.update");
  const input = electionDraftUpdateInputSchema.parse(rawInput);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_ELECTION_INFO, input.reason);
  const updated = await context.repository.updateElectionDraft(electionId, input);
  await context.repository.recordElectionChangeHistory({
    electionId,
    changedArea: "election",
    beforeSummary: { state: election.state, title: election.title },
    afterSummary: { state: updated.state, title: updated.title },
    changedById: context.session.userId,
    changedAt: nowFrom(context)
  });
  await audit(context, {
    eventType: "election.updated",
    targetType: "Election",
    targetId: electionId,
    reason: input.reason,
    beforeSummary: { state: election.state, title: election.title },
    afterSummary: { state: updated.state, title: updated.title }
  });
  return updated;
}

export async function createQuestion(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "question.write");
  const input = questionInputSchema.parse(rawInput);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_QUESTIONS);
  const question = await context.repository.createQuestion(electionId, input);
  await audit(context, {
    eventType: "question.created",
    targetType: "Question",
    targetId: question.id,
    afterSummary: { electionId, questionType: question.questionType, displayOrder: question.displayOrder }
  });
  return question;
}

export async function updateQuestion(
  electionId: string,
  questionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "question.write");
  const input = questionUpdateInputSchema.parse(rawInput);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_QUESTIONS, input.reason);
  const question = await context.repository.findQuestionById(questionId);
  if (!question || question.electionId !== electionId) {
    throw notFoundError("question");
  }
  const updated = await context.repository.updateQuestion(questionId, input);
  await audit(context, {
    eventType: "question.updated",
    targetType: "Question",
    targetId: questionId,
    reason: input.reason,
    beforeSummary: { questionType: question.questionType, displayOrder: question.displayOrder },
    afterSummary: { questionType: updated.questionType, displayOrder: updated.displayOrder }
  });
  return updated;
}

export async function createOption(
  electionId: string,
  questionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "question.write");
  const input = optionInputSchema.parse(rawInput);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_OPTIONS);
  const question = await context.repository.findQuestionById(questionId);
  if (!question || question.electionId !== electionId) {
    throw notFoundError("question");
  }
  const option = await context.repository.createOption(questionId, input);
  await audit(context, {
    eventType: "option.created",
    targetType: "Option",
    targetId: option.id,
    afterSummary: { electionId, questionId, displayOrder: option.displayOrder }
  });
  return option;
}

export async function updateOption(
  electionId: string,
  questionId: string,
  optionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "question.write");
  const input = optionUpdateInputSchema.parse(rawInput);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_OPTIONS, input.reason);
  const question = await context.repository.findQuestionById(questionId);
  const option = await context.repository.findOptionById(optionId);
  if (!question || question.electionId !== electionId || !option || option.questionId !== questionId) {
    throw notFoundError("option");
  }
  const updated = await context.repository.updateOption(optionId, input);
  await audit(context, {
    eventType: "option.updated",
    targetType: "Option",
    targetId: optionId,
    reason: input.reason,
    beforeSummary: { questionId, displayOrder: option.displayOrder },
    afterSummary: { questionId, displayOrder: updated.displayOrder }
  });
  return updated;
}

export async function configureAuthenticationPolicy(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "auth_policy.write");
  const parsed = authenticationPolicyInputSchema.parse(rawInput);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_ELECTION_INFO, parsed.reason);
  const input = normalizeAuthPolicyInput(parsed);
  const policy = await context.repository.upsertAuthenticationPolicy(electionId, input);
  await audit(context, {
    eventType: "authentication_policy.updated",
    targetType: "AuthenticationPolicy",
    targetId: electionId,
    reason: parsed.reason,
    afterSummary: {
      electionId,
      method: policy.method,
      isEnabled: policy.isEnabled,
      isPaidMethod: policy.isPaidMethod
    }
  });
  return policy;
}

export async function createOrGetVoterRegistry(
  electionId: string,
  sourceType: string,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "voter_registry.read");
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_VOTER_REGISTRY);
  return context.repository.createOrGetVoterRegistry(electionId, sourceType);
}

export async function importEligibleVoters(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "voter_registry.import");
  const input = voterRegistryImportInputSchema.parse(rawInput);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_VOTER_REGISTRY, input.reason);
  const registry = await context.repository.createOrGetVoterRegistry(electionId, input.sourceType);
  const importRecord = await context.repository.createVoterRegistryImport({
    voterRegistryId: registry.id,
    fileName: input.fileName,
    fileHash: input.fileHash,
    rowCount: input.rows.length,
    importStatus: "validated"
  });

  const seen = new Set<string>();
  const errors: ValidationErrorInput[] = [];
  let validRows = 0;

  for (const [index, row] of input.rows.entries()) {
    const rowNumber = index + 1;
    const externalIdentifierHmac = hmacValue(row.externalIdentifier, context.hmacKey);
    const duplicateInBatch = seen.has(externalIdentifierHmac);
    const duplicateExisting = await context.repository.findEligibleVoterByExternalIdentifierHmac(
      electionId,
      externalIdentifierHmac
    );
    if (duplicateInBatch || duplicateExisting) {
      errors.push({
        importId: importRecord.id,
        rowNumber,
        fieldName: "externalIdentifier",
        errorType: "duplicate",
        message: "Duplicate external identifier"
      });
      continue;
    }
    seen.add(externalIdentifierHmac);
    await context.repository.createEligibleVoter({
      electionId,
      voterRegistryId: registry.id,
      nameEncrypted: protectPersonalValue(row.name, context.hmacKey),
      emailEncrypted: protectPersonalValue(row.email, context.hmacKey),
      phoneEncrypted: protectPersonalValue(row.phone, context.hmacKey),
      externalIdentifierEncrypted: protectPersonalValue(row.externalIdentifier, context.hmacKey),
      externalIdentifierHmac,
      searchHmac: row.email ? hmacValue(row.email, context.hmacKey) : undefined
    });
    validRows += 1;
  }

  await context.repository.createValidationErrors(errors);
  await context.repository.updateVoterRegistryCounts({
    voterRegistryId: registry.id,
    status: errors.length > 0 ? "imported" : "validated",
    totalRows: input.rows.length,
    validRows
  });
  await audit(context, {
    eventType: "voter_registry.imported",
    targetType: "VoterRegistry",
    targetId: registry.id,
    reason: input.reason,
    afterSummary: {
      electionId,
      rowCount: input.rows.length,
      validRows,
      errorCount: errors.length
    }
  });

  return Object.freeze({
    registryId: registry.id,
    importId: importRecord.id,
    totalRows: input.rows.length,
    validRows,
    errorCount: errors.length,
    errors
  });
}

export async function validateVoterRegistry(
  electionId: string,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "voter_registry.validate");
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.EDIT_VOTER_REGISTRY);
  const registry = await context.repository.findVoterRegistryByElectionId(electionId);
  if (!registry) {
    throw notFoundError("voter registry");
  }
  const status = registry.totalRows === registry.validRows ? "validated" : "imported";
  await context.repository.updateVoterRegistryCounts({
    voterRegistryId: registry.id,
    status,
    totalRows: registry.totalRows,
    validRows: registry.validRows
  });
  await audit(context, {
    eventType: status === "validated" ? "voter_registry.validated" : "voter_registry.validation_failed",
    targetType: "VoterRegistry",
    targetId: registry.id,
    afterSummary: {
      electionId,
      totalRows: registry.totalRows,
      validRows: registry.validRows,
      status
    }
  });
  return { ...registry, status };
}

export async function requestElectionReview(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  requirePermission(context.session, "election.request_review");
  const input = reviewRequestInputSchema.parse(rawInput);
  const election = await getScopedElection(context, electionId);
  assertElectionTransitionAllowed(election.state, ElectionState.READY_FOR_REVIEW);
  await context.repository.updateElectionState(electionId, ElectionState.READY_FOR_REVIEW);
  await context.repository.recordElectionStateHistory({
    electionId,
    fromState: election.state,
    toState: ElectionState.READY_FOR_REVIEW,
    requestedById: context.session.userId,
    reason: input.reason,
    changeType: "review_requested",
    changedAt: nowFrom(context)
  });
  await audit(context, {
    eventType: "election.review_requested",
    targetType: "Election",
    targetId: electionId,
    reason: input.reason,
    beforeSummary: { state: election.state },
    afterSummary: { state: ElectionState.READY_FOR_REVIEW }
  });
  return { electionId, state: ElectionState.READY_FOR_REVIEW };
}

export async function approveElectionReview(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  return transitionElectionState(electionId, rawInput, context, ElectionState.APPROVED, {
    permissionCode: "election.approve",
    eventType: "election.approved",
    changeType: "approved"
  });
}

export async function scheduleElection(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  return transitionElectionState(electionId, rawInput, context, ElectionState.SCHEDULED, {
    permissionCode: "election.schedule",
    eventType: "election.scheduled",
    changeType: "scheduled"
  });
}

export async function openElection(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  return transitionElectionState(electionId, rawInput, context, ElectionState.OPEN, {
    permissionCode: "election.open",
    eventType: "election.opened",
    changeType: "opened"
  });
}

export async function pauseElection(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  return transitionElectionState(electionId, rawInput, context, ElectionState.PAUSED, {
    permissionCode: "election.pause",
    eventType: "election.paused",
    changeType: "paused"
  });
}

export async function resumeElection(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  return transitionElectionState(electionId, rawInput, context, ElectionState.OPEN, {
    permissionCode: "election.resume",
    eventType: "election.resumed",
    changeType: "resumed"
  });
}

export async function closeElection(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  return transitionElectionState(electionId, rawInput, context, ElectionState.CLOSED, {
    permissionCode: "election.close",
    eventType: "election.closed",
    changeType: "closed"
  });
}

export async function prepareInvitationsForElection(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  const input = invitationPrepareInputSchema.parse(rawInput);
  assertPermissionControls(context, "invitation.send", input.reason);
  const election = await getScopedElection(context, electionId);
  assertInvitationPreparationAllowed(election);
  await assertVoterRegistryReady(context, electionId);
  const voters = await context.repository.listEligibleVotersForElection(electionId);
  let invitationsCreated = 0;
  let credentialsCreated = 0;

  for (const voter of voters) {
    const invitationResult = await createInvitationForEligibleVoter(
      context,
      election,
      voter.id,
      "email"
    );
    if (invitationResult.created) {
      invitationsCreated += 1;
    }
    const credential = await createVotingCredentialForEligibleVoter(
      context,
      electionId,
      voter.id
    );
    if (credential) {
      credentialsCreated += 1;
      await audit(context, {
        eventType: "voting_credential.created",
        targetType: "VotingCredential",
        targetId: credential.id,
        afterSummary: { electionId }
      });
    }
  }

  await audit(context, {
    eventType: "invitation.prepared",
    targetType: "Election",
    targetId: electionId,
    reason: input.reason,
    afterSummary: {
      electionId,
      eligibleVoterCount: voters.length,
      invitationsCreated,
      credentialsCreated
    }
  });

  return Object.freeze({
    electionId,
    eligibleVoterCount: voters.length,
    invitationsCreated,
    credentialsCreated
  });
}

export async function issueInvitations(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  const input = invitationSendInputSchema.parse(rawInput);
  assertPermissionControls(context, "invitation.send", input.reason);
  const election = await getScopedElection(context, electionId);
  assertInvitationSendAllowed(election, input.reason);
  const prepared = await prepareInvitationsForElection(electionId, { reason: input.reason }, context);
  const voters = await context.repository.listEligibleVotersForElection(electionId);
  let sentCount = 0;

  for (const voter of voters) {
    const invitation = await context.repository.findInvitationByEligibleVoterId(electionId, voter.id);
    if (!invitation) {
      continue;
    }
    await context.repository.markInvitationSent({
      invitationId: invitation.id,
      channel: input.channel,
      sentAt: nowFrom(context)
    });
    await context.repository.recordDeliveryEvent({
      organizationId: election.organizationId,
      electionId,
      recipientType: "eligible_voter",
      recipientRefId: voter.id,
      channel: input.channel,
      deliveryType: "invitation",
      status: "sent",
      provider: "stub",
      sentAt: nowFrom(context)
    });
    sentCount += 1;
  }

  await audit(context, {
    eventType: "invitation.sent",
    targetType: "Election",
    targetId: electionId,
    reason: input.reason,
    afterSummary: {
      electionId,
      sentCount,
      prepared
    }
  });

  return Object.freeze({ electionId, sentCount });
}

export async function resendInvitation(
  electionId: string,
  rawInput: unknown,
  context: ElectionServiceContext
) {
  const input = invitationResendInputSchema.parse(rawInput);
  assertPermissionControls(context, "invitation.resend", input.reason);
  const election = await getScopedElection(context, electionId);
  assertInvitationSendAllowed(election, input.reason);
  const voters = await context.repository.listEligibleVotersForElection(electionId);
  const targetVoters = input.eligibleVoterId
    ? voters.filter((voter) => voter.id === input.eligibleVoterId)
    : voters;
  if (input.eligibleVoterId && targetVoters.length === 0) {
    throw notFoundError("eligible voter");
  }

  let resentCount = 0;
  for (const voter of targetVoters) {
    const invitation = await context.repository.findInvitationByEligibleVoterId(electionId, voter.id);
    if (!invitation) {
      continue;
    }
    await context.repository.markInvitationSent({
      invitationId: invitation.id,
      channel: input.channel,
      sentAt: nowFrom(context)
    });
    await context.repository.recordDeliveryEvent({
      organizationId: election.organizationId,
      electionId,
      recipientType: "eligible_voter",
      recipientRefId: voter.id,
      channel: input.channel,
      deliveryType: "invitation_resend",
      status: "sent",
      provider: "stub",
      sentAt: nowFrom(context)
    });
    resentCount += 1;
  }

  await audit(context, {
    eventType: "invitation.resent",
    targetType: "Election",
    targetId: electionId,
    reason: input.reason,
    afterSummary: { electionId, resentCount, targeted: Boolean(input.eligibleVoterId) }
  });

  return Object.freeze({ electionId, resentCount });
}

export const electionPrivacyBoundary = Object.freeze({
  hmacValue,
  protectPersonalValue
});
