import { describe, expect, it } from "vitest";

import { ElectionState } from "../../src/guardrails/index.js";
import { InMemoryAuditRecorder } from "../../src/server/audit/audit-event";
import { createMockAdminSession } from "../../src/server/auth/admin-session";
import {
  approveCorrection,
  confirmResult,
  createReportExportRequest,
  getPublicElectionResult,
  getReportExportDownloadInfo,
  invalidateElectionResult,
  publishResult,
  requestCorrection,
  tallyElectionResult
} from "../../src/server/results/result-service";
import type {
  CorrectionRequestRecord,
  ElectionStateHistoryInput,
  InvalidationRecordRecord,
  ReportExportRecord,
  ReportRecord,
  ResultElectionRecord,
  ResultItemInput,
  ResultRecord,
  ResultRepository,
  ResultVersionRecord,
  TallyBallotRecord,
  TallyQuestionRecord
} from "../../src/server/results/repository";
import {
  evaluateAnonymousResultPrivacyRisk,
  maskSmallGroupResultItems
} from "../../src/server/results/privacy-policy";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const ENDS_AT = new Date("2026-06-01T11:00:00.000Z");

function adminSession({ includeStepUp = true }: { includeStepUp?: boolean } = {}) {
  return createMockAdminSession({
    permissions: [
      "result.read",
      "result.tally",
      "result.confirm",
      "result.publish",
      "result.correct.request",
      "result.correct.approve",
      "election.invalidate",
      "report.export.request",
      "report.export.download"
    ],
    stepUp: includeStepUp
      ? {
          verifiedAt: new Date("2026-06-01T11:50:00.000Z"),
          expiresAt: new Date("2026-06-01T12:30:00.000Z"),
          permissionCodes: [
            "result.tally",
            "result.confirm",
            "result.publish",
            "result.correct.request",
            "result.correct.approve",
            "election.invalidate",
            "report.export.request",
            "report.export.download"
          ]
        }
      : undefined
  });
}

class InMemoryResultRepository implements ResultRepository {
  election: ResultElectionRecord = {
    id: "election-1",
    organizationId: "00000000-0000-0000-0000-000000000020",
    votingMode: "anonymous",
    state: ElectionState.CLOSED,
    endsAt: ENDS_AT
  };

  eligibleVoterCount = 12;
  questions: TallyQuestionRecord[] = [
    {
      id: "question-1",
      title: "Choose",
      questionType: "single_choice",
      displayOrder: 1,
      options: [
        { id: "option-a", label: "A", displayOrder: 1 },
        { id: "option-b", label: "B", displayOrder: 2 }
      ]
    }
  ];
  ballots: TallyBallotRecord[] = [
    {
      id: "ballot-current-a",
      electionId: "election-1",
      isCurrent: true,
      acceptanceStatus: "accepted",
      serverReceivedAt: new Date("2026-06-01T10:00:00.000Z"),
      votes: [
        {
          id: "vote-a",
          questionId: "question-1",
          answerType: "option",
          optionIds: ["option-a"],
          hasFreeText: false
        }
      ]
    },
    {
      id: "ballot-current-b",
      electionId: "election-1",
      isCurrent: true,
      acceptanceStatus: "accepted",
      serverReceivedAt: new Date("2026-06-01T10:30:00.000Z"),
      votes: [
        {
          id: "vote-b",
          questionId: "question-1",
          answerType: "option",
          optionIds: ["option-b"],
          hasFreeText: false
        }
      ]
    },
    {
      id: "ballot-old",
      electionId: "election-1",
      isCurrent: false,
      acceptanceStatus: "accepted",
      serverReceivedAt: new Date("2026-06-01T09:00:00.000Z"),
      votes: [
        {
          id: "vote-old",
          questionId: "question-1",
          answerType: "option",
          optionIds: ["option-a"],
          hasFreeText: false
        }
      ]
    },
    {
      id: "ballot-late",
      electionId: "election-1",
      isCurrent: true,
      acceptanceStatus: "accepted",
      serverReceivedAt: new Date("2026-06-01T11:01:00.000Z"),
      votes: [
        {
          id: "vote-late",
          questionId: "question-1",
          answerType: "option",
          optionIds: ["option-a"],
          hasFreeText: false
        }
      ]
    },
    {
      id: "ballot-rejected",
      electionId: "election-1",
      isCurrent: true,
      acceptanceStatus: "rejected_invalid",
      serverReceivedAt: new Date("2026-06-01T10:15:00.000Z"),
      votes: [
        {
          id: "vote-rejected",
          questionId: "question-1",
          answerType: "option",
          optionIds: ["option-b"],
          hasFreeText: false
        }
      ]
    }
  ];

  results: ResultRecord[] = [];
  versions: ResultVersionRecord[] = [];
  corrections: CorrectionRequestRecord[] = [];
  invalidations: InvalidationRecordRecord[] = [];
  reports: ReportRecord[] = [];
  exports: ReportExportRecord[] = [];
  stateHistory: ElectionStateHistoryInput[] = [];

  async findElectionById(electionId: string) {
    return electionId === this.election.id ? this.election : null;
  }

  async countEligibleVoters() {
    return this.eligibleVoterCount;
  }

  async listQuestionsWithOptions() {
    return this.questions;
  }

  async listBallotsForTally() {
    return this.ballots;
  }

  async createTalliedResult(input: {
    electionId: string;
    talliedById: string;
    talliedAt: Date;
    sourceRule: string;
    items: readonly ResultItemInput[];
  }) {
    const result: ResultRecord = {
      id: `result-${this.results.length + 1}`,
      electionId: input.electionId,
      status: "tallied",
      talliedAt: input.talliedAt,
      talliedById: input.talliedById,
      sourceRule: input.sourceRule,
      items: input.items.map((item, index) => ({
        id: `result-item-${index + 1}`,
        resultId: `result-${this.results.length + 1}`,
        questionId: item.questionId,
        optionId: item.optionId,
        voteCount: item.voteCount,
        masked: item.masked ?? false,
        displayLabel: item.displayLabel
      }))
    };
    this.results.push(result);
    return result;
  }

  async findLatestResult() {
    return this.results.at(-1) ?? null;
  }

  async findResultById(resultId: string) {
    return this.results.find((result) => result.id === resultId) ?? null;
  }

  async createResultVersion(input: {
    electionId: string;
    resultId: string;
    versionType: ResultVersionRecord["versionType"];
    status: ResultVersionRecord["status"];
    confirmedById: string;
    notice?: string;
  }) {
    const version: ResultVersionRecord = {
      id: `result-version-${this.versions.length + 1}`,
      electionId: input.electionId,
      resultId: input.resultId,
      versionNo: this.versions.length + 1,
      versionType: input.versionType,
      status: input.status,
      confirmedById: input.confirmedById,
      publishedAt: null,
      notice: input.notice
    };
    this.versions.push(version);
    return version;
  }

  async findLatestResultVersion() {
    return this.versions.at(-1) ?? null;
  }

  async findPublishedResultVersion() {
    return [...this.versions].reverse().find((version) => version.status === "published") ?? null;
  }

  async markResultVersionPublished(resultVersionId: string, publishedAt: Date, notice?: string) {
    const index = this.versions.findIndex((version) => version.id === resultVersionId);
    if (index < 0) {
      throw new Error("missing version");
    }
    this.versions[index] = {
      ...this.versions[index],
      status: "published",
      publishedAt,
      notice: notice ?? this.versions[index].notice
    };
    return this.versions[index];
  }

  async updateElectionState(_electionId: string, state: ResultElectionRecord["state"]) {
    this.election = { ...this.election, state };
  }

  async recordElectionStateHistory(input: ElectionStateHistoryInput) {
    this.stateHistory.push(input);
  }

  async createCorrectionRequest(input: {
    electionId: string;
    resultVersionId: string;
    reason: string;
    requestedById: string;
  }) {
    const correction: CorrectionRequestRecord = {
      id: `correction-${this.corrections.length + 1}`,
      status: "requested",
      approvedById: null,
      approvedAt: null,
      ...input
    };
    this.corrections.push(correction);
    return correction;
  }

  async findCorrectionRequest(correctionId: string) {
    return this.corrections.find((correction) => correction.id === correctionId) ?? null;
  }

  async approveCorrectionRequest(input: {
    correctionId: string;
    approvedById: string;
    approvedAt: Date;
  }) {
    const index = this.corrections.findIndex((correction) => correction.id === input.correctionId);
    if (index < 0) {
      throw new Error("missing correction");
    }
    this.corrections[index] = {
      ...this.corrections[index],
      status: "approved",
      approvedById: input.approvedById,
      approvedAt: input.approvedAt
    };
    return this.corrections[index];
  }

  async createInvalidationRecord(input: {
    electionId: string;
    resultVersionId?: string;
    reason: string;
    requestedById: string;
    approvedById: string;
    approvedAt: Date;
    notice?: string;
  }) {
    const invalidation: InvalidationRecordRecord = {
      id: `invalidation-${this.invalidations.length + 1}`,
      ...input
    };
    this.invalidations.push(invalidation);
    return invalidation;
  }

  async findReport(reportId: string) {
    return this.reports.find((report) => report.id === reportId) ?? null;
  }

  async createReportForResultVersion(input: {
    electionId: string;
    resultVersionId: string;
    reportType: ReportRecord["reportType"];
    format: string;
    generatedById: string;
  }) {
    const report: ReportRecord = {
      id: `report-${this.reports.length + 1}`,
      status: "requested",
      ...input
    };
    this.reports.push(report);
    return report;
  }

  async createReportExport(input: {
    reportId: string;
    requestedById: string;
    purpose: string;
    exportFormat: string;
    scopeSummary?: unknown;
    expiresAt: Date;
  }) {
    const exportRecord: ReportExportRecord = {
      id: `export-${this.exports.length + 1}`,
      status: "requested",
      approvedById: null,
      watermarkId: `wm-${this.exports.length + 1}`,
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
    if (index < 0) {
      throw new Error("missing export");
    }
    this.exports[index] = {
      ...this.exports[index],
      status: "downloaded",
      downloadedAt
    };
    return this.exports[index];
  }

  approveExport(exportId: string) {
    const index = this.exports.findIndex((exportRecord) => exportRecord.id === exportId);
    this.exports[index] = { ...this.exports[index], status: "approved" };
  }
}

function createContext(repository = new InMemoryResultRepository()) {
  const auditRecorder = new InMemoryAuditRecorder();
  return {
    repository,
    auditRecorder,
    context: {
      session: adminSession(),
      repository,
      auditRecorder,
      now: NOW
    }
  };
}

async function tallyConfirmPublish(repository: InMemoryResultRepository) {
  const auditRecorder = new InMemoryAuditRecorder();
  const context = { session: adminSession(), repository, auditRecorder, now: NOW };
  await tallyElectionResult(repository.election.id, {}, context);
  await confirmResult(repository.election.id, { reason: "checked" }, context);
  return publishResult(repository.election.id, { reason: "publish", notice: "published" }, context);
}

describe("result tally service", () => {
  it("counts only current accepted ballots received before election end", async () => {
    const { repository, context } = createContext();

    const output = await tallyElectionResult("election-1", {}, context);
    const result = repository.results[0];

    expect(output.tally_eligible_ballot_count).toBe(2);
    expect(result.sourceRule).toContain("is_current=true");
    expect(result.items.find((item) => item.optionId === "option-a")?.voteCount).toBe(1);
    expect(result.items.find((item) => item.optionId === "option-b")?.voteCount).toBe(1);
    expect(result.items.find((item) => item.displayLabel === "기권")?.voteCount).toBe(10);
    expect(repository.election.state).toBe(ElectionState.PENDING_CONFIRMATION);
    expect(repository.stateHistory.map((history) => history.toState)).toEqual([
      ElectionState.TALLYING,
      ElectionState.PENDING_CONFIRMATION
    ]);
  });

  it("does not leak ballot vote group or token hash fields in result responses", async () => {
    const { context } = createContext();

    const output = await tallyElectionResult("election-1", {}, context);
    const serialized = JSON.stringify(output);

    expect(serialized).not.toContain("ballot-current");
    expect(serialized).not.toContain("vote-a");
    expect(serialized).not.toContain("anonymousBallotGroup");
    expect(serialized).not.toContain("ballotGroupTokenHash");
  });
});

describe("result version and publication service", () => {
  it("runs result screen operations without step-up or reason input while keeping permission checks", async () => {
    const repository = new InMemoryResultRepository();
    const auditRecorder = new InMemoryAuditRecorder();
    const context = {
      session: adminSession({ includeStepUp: false }),
      repository,
      auditRecorder,
      now: NOW
    };

    await tallyElectionResult("election-1", {}, context);
    await confirmResult("election-1", {}, context);
    await publishResult("election-1", { notice: "official" }, context);
    await requestCorrection("election-1", { notice: "correction requested" }, context);
    const invalidated = await invalidateElectionResult(
      "election-1",
      { notice: "voided" },
      context
    );

    expect(invalidated.election_state).toBe(ElectionState.INVALIDATED);
  });

  it("creates a confirmed ResultVersion and forbids published overwrite paths", async () => {
    const { repository, context } = createContext();
    await tallyElectionResult("election-1", {}, context);

    const confirmed = await confirmResult("election-1", { reason: "review complete" }, context);

    expect(confirmed.result_version.version_no).toBe(1);
    expect(confirmed.result_version.status).toBe("confirmed");
    expect(repository.election.state).toBe(ElectionState.CONFIRMED);
    expect(repository.versions).toHaveLength(1);
  });

  it("publishes without overwriting results and shows every anonymous result count", async () => {
    const { repository, context } = createContext();
    repository.eligibleVoterCount = 8;
    await tallyElectionResult("election-1", {}, context);
    await confirmResult("election-1", { reason: "review complete" }, context);

    const published = await publishResult(
      "election-1",
      { reason: "publish approved", notice: "official" },
      context
    );

    expect(published.result_version.status).toBe("published");
    expect(published.result_version.notice).toBe("official");
    expect(published.privacy.canPublishCounts).toBe(true);
    const previewItems = published.public_result_preview.items as Array<{ masked?: boolean; vote_count?: number }>;
    expect(previewItems.every((item) => item.masked === false && typeof item.vote_count === "number")).toBe(true);
    expect(repository.election.state).toBe(ElectionState.PUBLISHED);
    expect(repository.results).toHaveLength(1);
  });

  it("requires CorrectionRequest and creates a new ResultVersion for published corrections", async () => {
    const repository = new InMemoryResultRepository();
    const { context } = createContext(repository);
    await tallyConfirmPublish(repository);

    const correction = await requestCorrection(
      "election-1",
      { reason: "published typo", notice: "correction requested" },
      context
    );
    const approved = await approveCorrection(
      "election-1",
      correction.correction_request.id,
      { reason: "approve correction", notice: "corrected notice" },
      context
    );

    expect(correction.correction_request.status).toBe("requested");
    expect(approved.correction_request.status).toBe("approved");
    expect(approved.result_version.version_type).toBe("correction");
    expect(approved.result_version.version_no).toBe(2);
    expect(repository.versions.find((version) => version.status === "published")?.versionNo).toBe(1);
  });

  it("invalidates through InvalidationRecord while preserving published result version", async () => {
    const repository = new InMemoryResultRepository();
    const { context } = createContext(repository);
    await tallyConfirmPublish(repository);

    const invalidated = await invalidateElectionResult(
      "election-1",
      { reason: "material error", notice: "voided" },
      context
    );

    expect(invalidated.invalidation_record.result_version_id).toBe("result-version-1");
    expect(repository.invalidations).toHaveLength(1);
    expect(repository.election.state).toBe(ElectionState.INVALIDATED);
    expect(repository.versions[0].status).toBe("published");
  });
});

describe("anonymous result privacy policy", () => {
  it("allows count publication below the voter-count threshold", () => {
    const evaluation = evaluateAnonymousResultPrivacyRisk({
      votingMode: "anonymous",
      eligibleVoterCount: 9,
      items: [{ questionId: "q1", optionId: "o1", voteCount: 9 }]
    });

    expect(evaluation.canPublishCounts).toBe(true);
    expect(evaluation.requiredAction).toBe("none");
    expect(evaluation.maskedResultItems).toEqual([]);
  });

  it("shows option counts below the per-option threshold", () => {
    const items = [
      { questionId: "q1", optionId: "o1", voteCount: 2 },
      { questionId: "q1", optionId: "o2", voteCount: 8 }
    ];
    const evaluation = evaluateAnonymousResultPrivacyRisk({
      votingMode: "anonymous",
      eligibleVoterCount: 12,
      items
    });

    expect(evaluation.canPublishCounts).toBe(true);
    expect(evaluation.requiredAction).toBe("none");
    expect(maskSmallGroupResultItems(items, evaluation)).toEqual([
      expect.objectContaining({ optionId: "o1", masked: false, publicVoteCount: 2 }),
      expect.objectContaining({ optionId: "o2", masked: false, publicVoteCount: 8 })
    ]);
  });
});

describe("report exports and public result access", () => {
  it("requires purpose in the body and audits report export download", async () => {
    const repository = new InMemoryResultRepository();
    const { context, auditRecorder } = createContext(repository);
    await tallyConfirmPublish(repository);
    const report = await repository.createReportForResultVersion({
      electionId: "election-1",
      resultVersionId: "result-version-1",
      reportType: "result_summary",
      format: "pdf",
      generatedById: context.session.userId
    });

    const exportRequest = await createReportExportRequest(
      report.id,
      { purpose: "board archive", format: "pdf", scope: { resultVersionId: "result-version-1" } },
      context
    );
    repository.approveExport(exportRequest.export_request.id);
    const download = await getReportExportDownloadInfo(exportRequest.export_request.id, context);

    expect(download.download_ready).toBe(true);
    expect(auditRecorder.events.map((event) => event.eventType)).toContain("report.export_requested");
    expect(auditRecorder.events.map((event) => event.eventType)).toContain("report.export_downloaded");
  });

  it("forbids public result before Published and allows limited fields after Published", async () => {
    const repository = new InMemoryResultRepository();
    await expect(getPublicElectionResult("election-1", { repository, now: NOW })).rejects.toThrow();

    await tallyConfirmPublish(repository);
    const publicResult = await getPublicElectionResult("election-1", { repository, now: NOW });
    const serialized = JSON.stringify(publicResult);

    expect(publicResult.result_version.status).toBe("published");
    expect(publicResult.result_version.notice).toBe("published");
    expect(serialized).not.toContain("ballot");
    expect(serialized).not.toContain("vote-a");
    expect(serialized).not.toContain("anonymousBallotGroup");
    expect(serialized).not.toContain("ballotGroupTokenHash");
  });
});
