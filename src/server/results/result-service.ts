import { getTallyEligibleBallots } from "../../domain/ballots/ballot-policy";
import { ElectionAction, canPerformElectionAction } from "../../domain/elections/actions";
import { assertElectionTransitionAllowed } from "../../domain/elections/state-machine";
import {
  assertPublishedResultNotOverwritten,
  canOverwritePublishedResult,
  canPublishResultVersion,
  requiresCorrectionRequestForPublishedChange,
  requiresInvalidationRecord
} from "../../domain/results/result-policy";
import { PolicyDecision } from "../../domain/policy-decision";
import { ElectionState, PERMISSION_BY_CODE, ControlRequirement } from "../../guardrails/index.js";
import {
  createAuditEventPayload,
  recordAuditEvent,
  type AuditRecorder
} from "../audit/audit-event";
import type { AdminSession } from "../auth/admin-session";
import { ApiError, createForbiddenError } from "../http/errors";
import { sanitizeResponseForRole } from "../privacy/field-exposure";
import { redactSensitiveValues } from "../privacy/redaction";
import { requirePermission, requirePermissionWithStepUp } from "../rbac/authorize";
import {
  canPublishResultCounts,
  evaluateAnonymousResultPrivacyRisk,
  maskSmallGroupResultItems,
  type ResultPrivacyEvaluation
} from "./privacy-policy";
import type {
  ResultElectionRecord,
  ResultItemInput,
  ResultRecord,
  ResultRepository,
  ResultVersionRecord,
  TallyBallotRecord,
  TallyQuestionRecord
} from "./repository";
import {
  approveCorrectionInputSchema,
  correctionRequestInputSchema,
  invalidateElectionInputSchema,
  optionalReasonSchema,
  publishResultInputSchema,
  reasonRequiredSchema,
  reportExportRequestInputSchema
} from "./validation";

export type ResultServiceContext = Readonly<{
  session: AdminSession;
  repository: ResultRepository;
  auditRecorder?: AuditRecorder;
  now?: Date;
}>;

export type PublicResultContext = Readonly<{
  repository: ResultRepository;
  now?: Date;
}>;

const OFFICIAL_TALLY_SOURCE_RULE =
  "is_current=true; acceptance_status=accepted; server_received_at<=election.ends_at";

function nowFrom(context: { now?: Date }): Date {
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

function assertOrganizationScope(session: AdminSession, election: ResultElectionRecord): void {
  if (session.organizationId && session.organizationId !== election.organizationId) {
    throw notFoundError("election");
  }
}

function permissionRequiresReason(permissionCode: string): boolean {
  return PERMISSION_BY_CODE[permissionCode]?.reason === ControlRequirement.YES;
}

function assertPermissionControls(
  context: ResultServiceContext,
  permissionCode: string,
  reason?: string
): void {
  requirePermissionWithStepUp(context.session, permissionCode, nowFrom(context));
  if (permissionRequiresReason(permissionCode) && !reason?.trim()) {
    throw validationError(`${permissionCode} requires reason`);
  }
}

function assertElectionActionAllowed(
  election: ResultElectionRecord,
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
  context: ResultServiceContext,
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
  context: ResultServiceContext,
  electionId: string
): Promise<ResultElectionRecord> {
  const election = await context.repository.findElectionById(electionId);
  if (!election) {
    throw notFoundError("election");
  }
  assertOrganizationScope(context.session, election);
  return election;
}

async function transitionElectionState(
  context: ResultServiceContext,
  election: ResultElectionRecord,
  toState: ResultElectionRecord["state"],
  reason: string | undefined,
  changeType: string
): Promise<ResultElectionRecord["state"]> {
  try {
    assertElectionTransitionAllowed(election.state, toState);
  } catch {
    throw conflictError(`transition denied: ${election.state} -> ${toState}`);
  }
  await context.repository.updateElectionState(election.id, toState);
  await context.repository.recordElectionStateHistory({
    electionId: election.id,
    fromState: election.state,
    toState,
    requestedById: context.session.userId,
    approvedById: context.session.userId,
    reason,
    changeType,
    changedAt: nowFrom(context)
  });
  return toState;
}

async function safeTransitionElectionState(
  context: ResultServiceContext,
  electionId: string,
  fromState: ResultElectionRecord["state"],
  toState: ResultElectionRecord["state"],
  reason: string | undefined,
  changeType: string
): Promise<ResultElectionRecord["state"]> {
  const syntheticElection = {
    id: electionId,
    organizationId: context.session.organizationId ?? "",
    votingMode: "anonymous" as const,
    state: fromState,
    endsAt: nowFrom(context)
  };
  return transitionElectionState(context, syntheticElection, toState, reason, changeType);
}

function aggregateResultItems(
  questions: readonly TallyQuestionRecord[],
  ballots: readonly TallyBallotRecord[]
): ResultItemInput[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const countByKey = new Map<string, ResultItemInput>();

  for (const question of questions) {
    if (question.questionType === "free_text") {
      countByKey.set(`${question.id}:free_text`, {
        questionId: question.id,
        optionId: null,
        voteCount: 0,
        displayLabel: "free_text_response_count"
      });
      continue;
    }
    for (const option of question.options) {
      countByKey.set(`${question.id}:${option.id}`, {
        questionId: question.id,
        optionId: option.id,
        voteCount: 0,
        displayLabel: option.label
      });
    }
    countByKey.set(`${question.id}:abstain`, {
      questionId: question.id,
      optionId: null,
      voteCount: 0,
      displayLabel: "abstain"
    });
  }

  for (const ballot of ballots) {
    for (const vote of ballot.votes) {
      const question = questionById.get(vote.questionId);
      if (!question) {
        continue;
      }
      if (vote.answerType === "abstain") {
        const key = `${vote.questionId}:abstain`;
        const item = countByKey.get(key);
        if (item) {
          countByKey.set(key, { ...item, voteCount: item.voteCount + 1 });
        }
        continue;
      }
      if (vote.answerType === "free_text") {
        const key = `${vote.questionId}:free_text`;
        const item = countByKey.get(key);
        if (item && vote.hasFreeText) {
          countByKey.set(key, { ...item, voteCount: item.voteCount + 1 });
        }
        continue;
      }
      for (const optionId of vote.optionIds) {
        const key = `${vote.questionId}:${optionId}`;
        const item = countByKey.get(key);
        if (item) {
          countByKey.set(key, { ...item, voteCount: item.voteCount + 1 });
        }
      }
    }
  }

  return Array.from(countByKey.values());
}

function resultDto(
  result: ResultRecord,
  evaluation?: ResultPrivacyEvaluation,
  role = "ElectionManager"
) {
  const items = evaluation
    ? maskSmallGroupResultItems(result.items, evaluation).map((item) => ({
        question_id: item.questionId,
        option_id: item.optionId,
        display_label: item.displayLabel,
        masked: item.masked,
        vote_count: item.masked ? undefined : item.publicVoteCount
      }))
    : result.items.map((item) => ({
        question_id: item.questionId,
        option_id: item.optionId,
        display_label: item.displayLabel,
        masked: item.masked,
        vote_count: item.voteCount
      }));

  return sanitizeResponseForRole(
    role,
    {
      result_id: result.id,
      election_id: result.electionId,
      status: result.status,
      tallied_at: result.talliedAt?.toISOString(),
      source_rule: result.sourceRule,
      privacy_risk_level: evaluation?.privacyRiskLevel,
      can_publish_counts: evaluation?.canPublishCounts,
      masked_result_items: evaluation?.maskedResultItems,
      required_action: evaluation?.requiredAction,
      items
    },
    { anonymousVoting: true }
  );
}

function versionDto(version: ResultVersionRecord) {
  return {
    result_version_id: version.id,
    election_id: version.electionId,
    result_id: version.resultId,
    version_no: version.versionNo,
    version_type: version.versionType,
    status: version.status,
    published_at: version.publishedAt?.toISOString(),
    notice: version.notice
  };
}

async function evaluatePrivacyForResult(
  repository: ResultRepository,
  election: ResultElectionRecord,
  result: ResultRecord
): Promise<ResultPrivacyEvaluation> {
  const eligibleVoterCount = await repository.countEligibleVoters(election.id);
  return evaluateAnonymousResultPrivacyRisk({
    votingMode: election.votingMode,
    eligibleVoterCount,
    items: result.items
  });
}

export async function tallyElectionResult(
  electionId: string,
  rawInput: unknown,
  context: ResultServiceContext
) {
  const input = optionalReasonSchema.parse(rawInput);
  assertPermissionControls(context, "result.tally", input.reason);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.TALLY_RESULT, input.reason);

  await transitionElectionState(context, election, ElectionState.TALLYING, input.reason, "result_tally_started");
  const [questions, rawBallots] = await Promise.all([
    context.repository.listQuestionsWithOptions(electionId),
    context.repository.listBallotsForTally(electionId)
  ]);
  const tallyEligibleBallots = getTallyEligibleBallots(rawBallots, election);
  const items = aggregateResultItems(questions, tallyEligibleBallots);
  const result = await context.repository.createTalliedResult({
    electionId,
    talliedById: context.session.userId,
    talliedAt: nowFrom(context),
    sourceRule: OFFICIAL_TALLY_SOURCE_RULE,
    items
  });
  await safeTransitionElectionState(
    context,
    electionId,
    ElectionState.TALLYING,
    ElectionState.PENDING_CONFIRMATION,
    input.reason,
    "result_tally_completed"
  );
  await audit(context, {
    eventType: "result.tallied",
    targetType: "Result",
    targetId: result.id,
    reason: input.reason,
    afterSummary: {
      electionId,
      tallyEligibleBallotCount: tallyEligibleBallots.length,
      itemCount: result.items.length
    }
  });
  return {
    result: resultDto(result),
    tally_eligible_ballot_count: tallyEligibleBallots.length,
    election_state: ElectionState.PENDING_CONFIRMATION
  };
}

export async function getElectionResult(electionId: string, context: ResultServiceContext) {
  requirePermission(context.session, "result.read");
  const election = await getScopedElection(context, electionId);
  const result = await context.repository.findLatestResult(electionId);
  if (!result) {
    throw notFoundError("result");
  }
  const latestVersion = await context.repository.findLatestResultVersion(electionId);
  const evaluation = await evaluatePrivacyForResult(context.repository, election, result);
  return {
    result: resultDto(result, evaluation),
    latest_version: latestVersion ? versionDto(latestVersion) : null
  };
}

export async function confirmResult(
  electionId: string,
  rawInput: unknown,
  context: ResultServiceContext
) {
  const input = reasonRequiredSchema.parse(rawInput);
  assertPermissionControls(context, "result.confirm", input.reason);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.CONFIRM_RESULT, input.reason);
  const result = await context.repository.findLatestResult(electionId);
  if (!result) {
    throw notFoundError("result");
  }
  const version = await context.repository.createResultVersion({
    electionId,
    resultId: result.id,
    versionType: "initial",
    status: "confirmed",
    confirmedById: context.session.userId,
    notice: input.reason
  });
  await transitionElectionState(context, election, ElectionState.CONFIRMED, input.reason, "result_confirmed");
  await audit(context, {
    eventType: "result.confirmed",
    targetType: "ResultVersion",
    targetId: version.id,
    reason: input.reason,
    afterSummary: { electionId, resultId: result.id, versionNo: version.versionNo }
  });
  return { result_version: versionDto(version), election_state: ElectionState.CONFIRMED };
}

export async function publishResult(
  electionId: string,
  rawInput: unknown,
  context: ResultServiceContext
) {
  const input = publishResultInputSchema.parse(rawInput);
  assertPermissionControls(context, "result.publish", input.reason);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.PUBLISH_RESULT, input.reason);
  if (!canPublishResultVersion(election.state)) {
    throw conflictError(`result publish denied in ${election.state}`);
  }
  const version = await context.repository.findLatestResultVersion(electionId);
  if (!version || version.status !== "confirmed") {
    throw notFoundError("confirmed result version");
  }
  const result = await context.repository.findLatestResult(electionId);
  if (!result || result.id !== version.resultId) {
    throw notFoundError("result");
  }
  const evaluation = await evaluatePrivacyForResult(context.repository, election, result);
  const published = await context.repository.markResultVersionPublished(
    version.id,
    nowFrom(context),
    input.notice
  );
  await transitionElectionState(context, election, ElectionState.PUBLISHED, input.reason, "result_published");
  await audit(context, {
    eventType: "result.published",
    targetType: "ResultVersion",
    targetId: published.id,
    reason: input.reason,
    afterSummary: {
      electionId,
      versionNo: published.versionNo,
      privacyRiskLevel: evaluation.privacyRiskLevel,
      canPublishCounts: canPublishResultCounts({
        votingMode: election.votingMode,
        eligibleVoterCount: await context.repository.countEligibleVoters(election.id),
        items: result.items
      })
    }
  });
  return {
    result_version: versionDto(published),
    privacy: evaluation,
    public_result_preview: resultDto(result, evaluation, "PublicViewer"),
    election_state: ElectionState.PUBLISHED
  };
}

export function assertPublishedResultOverwriteForbidden(): false {
  assertPublishedResultNotOverwritten("overwrite");
  return canOverwritePublishedResult();
}

export async function requestCorrection(
  electionId: string,
  rawInput: unknown,
  context: ResultServiceContext
) {
  const input = correctionRequestInputSchema.parse(rawInput);
  assertPermissionControls(context, "result.correct.request", input.reason);
  const election = await getScopedElection(context, electionId);
  if (!requiresCorrectionRequestForPublishedChange(election.state)) {
    throw conflictError(`correction request denied in ${election.state}`);
  }
  const published = await context.repository.findPublishedResultVersion(electionId);
  if (!published) {
    throw notFoundError("published result version");
  }
  const correction = await context.repository.createCorrectionRequest({
    electionId,
    resultVersionId: published.id,
    reason: input.reason,
    requestedById: context.session.userId
  });
  await audit(context, {
    eventType: "result.correction_requested",
    targetType: "CorrectionRequest",
    targetId: correction.id,
    reason: input.reason,
    afterSummary: { electionId, resultVersionId: published.id }
  });
  return {
    correction_request: {
      id: correction.id,
      status: correction.status,
      result_version_id: correction.resultVersionId
    }
  };
}

export async function approveCorrection(
  electionId: string,
  correctionId: string,
  rawInput: unknown,
  context: ResultServiceContext
) {
  const input = approveCorrectionInputSchema.parse(rawInput);
  assertPermissionControls(context, "result.correct.approve", input.reason);
  const election = await getScopedElection(context, electionId);
  if (election.state !== ElectionState.PUBLISHED) {
    throw conflictError(`correction approval denied in ${election.state}`);
  }
  const correction = await context.repository.findCorrectionRequest(correctionId);
  if (!correction || correction.electionId !== electionId) {
    throw notFoundError("correction request");
  }
  const result = await context.repository.findLatestResult(electionId);
  if (!result) {
    throw notFoundError("result");
  }
  const approved = await context.repository.approveCorrectionRequest({
    correctionId,
    approvedById: context.session.userId,
    approvedAt: nowFrom(context)
  });
  const version = await context.repository.createResultVersion({
    electionId,
    resultId: result.id,
    versionType: "correction",
    status: "confirmed",
    confirmedById: context.session.userId,
    notice: input.notice ?? input.reason
  });
  await audit(context, {
    eventType: "result.correction_approved",
    targetType: "ResultVersion",
    targetId: version.id,
    reason: input.reason,
    afterSummary: { correctionId: approved.id, versionNo: version.versionNo }
  });
  return {
    correction_request: {
      id: approved.id,
      status: approved.status,
      approved_at: approved.approvedAt?.toISOString()
    },
    result_version: versionDto(version)
  };
}

export async function invalidateElectionResult(
  electionId: string,
  rawInput: unknown,
  context: ResultServiceContext
) {
  const input = invalidateElectionInputSchema.parse(rawInput);
  assertPermissionControls(context, "election.invalidate", input.reason);
  const election = await getScopedElection(context, electionId);
  assertElectionActionAllowed(election, ElectionAction.INVALIDATE_ELECTION, input.reason);
  if (!requiresInvalidationRecord(election.state)) {
    throw conflictError(`invalidation denied in ${election.state}`);
  }
  const published = await context.repository.findPublishedResultVersion(electionId);
  const invalidation = await context.repository.createInvalidationRecord({
    electionId,
    resultVersionId: published?.id,
    reason: input.reason,
    requestedById: context.session.userId,
    approvedById: context.session.userId,
    approvedAt: nowFrom(context),
    notice: input.notice
  });
  await transitionElectionState(context, election, ElectionState.INVALIDATED, input.reason, "election_invalidated");
  await audit(context, {
    eventType: "election.invalidated",
    targetType: "InvalidationRecord",
    targetId: invalidation.id,
    reason: input.reason,
    afterSummary: { electionId, resultVersionId: published?.id }
  });
  return {
    invalidation_record: {
      id: invalidation.id,
      result_version_id: invalidation.resultVersionId,
      approved_at: invalidation.approvedAt?.toISOString(),
      notice: invalidation.notice
    },
    election_state: ElectionState.INVALIDATED
  };
}

export async function createReportExportRequest(
  reportId: string,
  rawInput: unknown,
  context: ResultServiceContext
) {
  const input = reportExportRequestInputSchema.parse(rawInput);
  assertPermissionControls(context, "report.export.request", input.purpose);
  const report = await context.repository.findReport(reportId);
  if (!report) {
    throw notFoundError("report");
  }
  const exportRecord = await context.repository.createReportExport({
    reportId,
    requestedById: context.session.userId,
    purpose: input.purpose,
    exportFormat: input.format,
    scopeSummary: input.scope,
    expiresAt: new Date(nowFrom(context).getTime() + 15 * 60 * 1000)
  });
  await audit(context, {
    eventType: "report.export_requested",
    targetType: "ReportExport",
    targetId: exportRecord.id,
    reason: input.purpose,
    afterSummary: {
      reportId,
      exportFormat: exportRecord.exportFormat,
      expiresAt: exportRecord.expiresAt?.toISOString()
    }
  });
  return {
    export_request: {
      id: exportRecord.id,
      status: exportRecord.status,
      report_id: exportRecord.reportId,
      expires_at: exportRecord.expiresAt?.toISOString()
    }
  };
}

export async function getReportExportDownloadInfo(
  exportId: string,
  context: ResultServiceContext
) {
  assertPermissionControls(context, "report.export.download", "download approved report export");
  const exportRecord = await context.repository.findReportExport(exportId);
  if (!exportRecord) {
    throw notFoundError("report export");
  }
  if (!["approved", "ready", "downloaded"].includes(exportRecord.status)) {
    throw createForbiddenError(`report export is not approved for download: ${exportRecord.status}`);
  }
  if (exportRecord.expiresAt && exportRecord.expiresAt <= nowFrom(context)) {
    throw conflictError("report export download link expired");
  }
  const downloaded = await context.repository.markReportExportDownloaded(exportId, nowFrom(context));
  await audit(context, {
    eventType: "report.export_downloaded",
    targetType: "ReportExport",
    targetId: exportId,
    reason: "download approved report export",
    afterSummary: {
      status: downloaded.status,
      downloadedAt: downloaded.downloadedAt?.toISOString(),
      watermarkId: downloaded.watermarkId
    }
  });
  return {
    export_id: downloaded.id,
    status: downloaded.status,
    download_ready: true,
    expires_at: downloaded.expiresAt?.toISOString(),
    watermark_id: downloaded.watermarkId,
    download_url: undefined
  };
}

export async function getPublicElectionResult(electionId: string, context: PublicResultContext) {
  const election = await context.repository.findElectionById(electionId);
  if (!election) {
    throw notFoundError("election");
  }
  if (election.state !== ElectionState.PUBLISHED) {
    throw createForbiddenError("public result requested before published state");
  }
  const version = await context.repository.findPublishedResultVersion(electionId);
  if (!version) {
    throw notFoundError("published result");
  }
  const result = await context.repository.findResultById(version.resultId);
  if (!result) {
    throw notFoundError("published result");
  }
  const evaluation = await evaluatePrivacyForResult(context.repository, election, result);
  return {
    result_version: versionDto(version),
    result: resultDto(result, evaluation, "PublicViewer")
  };
}
