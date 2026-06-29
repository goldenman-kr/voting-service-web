import type { ElectionStateValue } from "../../domain/elections/state-machine";

export type VotingModeValue = "anonymous" | "named";
export type QuestionTypeValue = "single_choice" | "multiple_choice" | "yes_no" | "free_text";
export type BallotAcceptanceStatusValue =
  | "accepted"
  | "rejected_late"
  | "rejected_invalid"
  | "superseded";
export type VoteAnswerTypeValue = "option" | "free_text" | "abstain";
export type ResultVersionStatusValue = "confirmed" | "published" | "superseded";
export type ResultVersionTypeValue = "initial" | "correction" | "withdrawal" | "invalidation_notice";
export type ReportTypeValue =
  | "result_summary"
  | "question_detail"
  | "participation"
  | "audit_summary"
  | "admin_activity"
  | "dispute"
  | "invalidation_correction";
export type ExportStatusValue =
  | "requested"
  | "approved"
  | "rejected"
  | "ready"
  | "downloaded"
  | "expired"
  | "failed";
export type CorrectionStatusValue = "requested" | "approved" | "rejected" | "applied";

export type ResultElectionRecord = Readonly<{
  id: string;
  organizationId: string;
  votingMode: VotingModeValue;
  state: ElectionStateValue;
  endsAt: Date;
}>;

export type TallyQuestionRecord = Readonly<{
  id: string;
  title: string;
  questionType: QuestionTypeValue;
  displayOrder: number;
  options: readonly Readonly<{
    id: string;
    label: string;
    displayOrder: number;
  }>[];
}>;

export type TallyBallotRecord = Readonly<{
  id: string;
  electionId: string;
  isCurrent: boolean;
  acceptanceStatus: BallotAcceptanceStatusValue;
  serverReceivedAt: Date;
  votes: readonly Readonly<{
    id: string;
    questionId: string;
    answerType: VoteAnswerTypeValue;
    optionIds: readonly string[];
    hasFreeText: boolean;
  }>[];
}>;

export type ResultItemInput = Readonly<{
  questionId: string;
  optionId?: string | null;
  voteCount: number;
  masked?: boolean;
  displayLabel?: string | null;
}>;

export type ResultItemRecord = ResultItemInput & Readonly<{
  id: string;
  resultId: string;
}>;

export type ResultRecord = Readonly<{
  id: string;
  electionId: string;
  status: "draft" | "tallied" | "discarded";
  talliedAt?: Date | null;
  talliedById?: string | null;
  sourceRule: string;
  items: readonly ResultItemRecord[];
}>;

export type ResultVersionRecord = Readonly<{
  id: string;
  electionId: string;
  resultId: string;
  versionNo: number;
  versionType: ResultVersionTypeValue;
  status: ResultVersionStatusValue;
  confirmedById?: string | null;
  publishedAt?: Date | null;
  notice?: string | null;
}>;

export type CorrectionRequestRecord = Readonly<{
  id: string;
  electionId: string;
  resultVersionId: string;
  status: CorrectionStatusValue;
  reason: string;
  requestedById: string;
  approvedById?: string | null;
  approvedAt?: Date | null;
}>;

export type InvalidationRecordRecord = Readonly<{
  id: string;
  electionId: string;
  resultVersionId?: string | null;
  reason: string;
  requestedById: string;
  approvedById?: string | null;
  notice?: string | null;
  approvedAt?: Date | null;
}>;

export type ReportRecord = Readonly<{
  id: string;
  electionId: string;
  resultVersionId: string;
  reportType: ReportTypeValue;
  format: string;
  status: ExportStatusValue;
}>;

export type ReportExportRecord = Readonly<{
  id: string;
  reportId: string;
  requestedById: string;
  approvedById?: string | null;
  status: ExportStatusValue;
  purpose: string;
  exportFormat: string;
  scopeSummary?: unknown;
  watermarkId?: string | null;
  expiresAt?: Date | null;
  downloadedAt?: Date | null;
}>;

export type ElectionStateHistoryInput = Readonly<{
  electionId: string;
  fromState?: ElectionStateValue | null;
  toState: ElectionStateValue;
  requestedById?: string;
  approvedById?: string;
  reason?: string;
  changeType: string;
  changedAt: Date;
}>;

export type ResultRepository = {
  findElectionById(electionId: string): Promise<ResultElectionRecord | null>;
  countEligibleVoters(electionId: string): Promise<number>;
  listQuestionsWithOptions(electionId: string): Promise<TallyQuestionRecord[]>;
  listBallotsForTally(electionId: string): Promise<TallyBallotRecord[]>;

  createTalliedResult(input: {
    electionId: string;
    talliedById: string;
    talliedAt: Date;
    sourceRule: string;
    items: readonly ResultItemInput[];
  }): Promise<ResultRecord>;
  findLatestResult(electionId: string): Promise<ResultRecord | null>;
  findResultById(resultId: string): Promise<ResultRecord | null>;

  createResultVersion(input: {
    electionId: string;
    resultId: string;
    versionType: ResultVersionTypeValue;
    status: ResultVersionStatusValue;
    confirmedById: string;
    notice?: string;
  }): Promise<ResultVersionRecord>;
  findLatestResultVersion(electionId: string): Promise<ResultVersionRecord | null>;
  findPublishedResultVersion(electionId: string): Promise<ResultVersionRecord | null>;
  markResultVersionPublished(
    resultVersionId: string,
    publishedAt: Date,
    notice?: string
  ): Promise<ResultVersionRecord>;

  updateElectionState(electionId: string, state: ElectionStateValue): Promise<void>;
  recordElectionStateHistory(input: ElectionStateHistoryInput): Promise<void>;

  createCorrectionRequest(input: {
    electionId: string;
    resultVersionId: string;
    reason: string;
    requestedById: string;
  }): Promise<CorrectionRequestRecord>;
  findCorrectionRequest(correctionId: string): Promise<CorrectionRequestRecord | null>;
  approveCorrectionRequest(input: {
    correctionId: string;
    approvedById: string;
    approvedAt: Date;
  }): Promise<CorrectionRequestRecord>;

  createInvalidationRecord(input: {
    electionId: string;
    resultVersionId?: string;
    reason: string;
    requestedById: string;
    approvedById: string;
    approvedAt: Date;
    notice?: string;
  }): Promise<InvalidationRecordRecord>;

  findReport(reportId: string): Promise<ReportRecord | null>;
  createReportForResultVersion(input: {
    electionId: string;
    resultVersionId: string;
    reportType: ReportTypeValue;
    format: string;
    generatedById: string;
  }): Promise<ReportRecord>;
  createReportExport(input: {
    reportId: string;
    requestedById: string;
    purpose: string;
    exportFormat: string;
    scopeSummary?: unknown;
    expiresAt: Date;
  }): Promise<ReportExportRecord>;
  findReportExport(exportId: string): Promise<ReportExportRecord | null>;
  markReportExportDownloaded(exportId: string, downloadedAt: Date): Promise<ReportExportRecord>;
};
