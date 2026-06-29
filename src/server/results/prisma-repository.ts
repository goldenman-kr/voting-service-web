import {
  BallotAcceptanceStatus,
  ElectionState,
  ExportStatus,
  Prisma,
  RecordStatus,
  ReportType,
  ResultStatus,
  ResultVersionStatus,
  ResultVersionType
} from "@prisma/client";

import type { PrismaClientLike } from "../db/prisma";
import type {
  CorrectionRequestRecord,
  ElectionStateHistoryInput,
  InvalidationRecordRecord,
  ReportExportRecord,
  ReportRecord,
  ResultElectionRecord,
  ResultItemRecord,
  ResultRecord,
  ResultRepository,
  ResultVersionRecord,
  TallyBallotRecord,
  TallyQuestionRecord
} from "./repository";

function mapElection(record: {
  id: string;
  organizationId: string;
  votingMode: string;
  state: string;
  endsAt: Date;
}): ResultElectionRecord {
  return Object.freeze({
    id: record.id,
    organizationId: record.organizationId,
    votingMode: record.votingMode as ResultElectionRecord["votingMode"],
    state: record.state as ResultElectionRecord["state"],
    endsAt: record.endsAt
  });
}

function mapQuestion(record: {
  id: string;
  title: string;
  questionType: string;
  displayOrder: number;
  options: { id: string; label: string; displayOrder: number }[];
}): TallyQuestionRecord {
  return Object.freeze({
    id: record.id,
    title: record.title,
    questionType: record.questionType as TallyQuestionRecord["questionType"],
    displayOrder: record.displayOrder,
    options: record.options.map((option) =>
      Object.freeze({
        id: option.id,
        label: option.label,
        displayOrder: option.displayOrder
      })
    )
  });
}

function mapResultItem(record: {
  id: string;
  resultId: string;
  questionId: string;
  optionId: string | null;
  voteCount: number;
  masked: boolean;
  displayLabel: string | null;
}): ResultItemRecord {
  return Object.freeze({
    id: record.id,
    resultId: record.resultId,
    questionId: record.questionId,
    optionId: record.optionId,
    voteCount: record.voteCount,
    masked: record.masked,
    displayLabel: record.displayLabel
  });
}

function mapResult(record: {
  id: string;
  electionId: string;
  status: string;
  talliedAt: Date | null;
  talliedById: string | null;
  sourceRule: string;
  items: {
    id: string;
    resultId: string;
    questionId: string;
    optionId: string | null;
    voteCount: number;
    masked: boolean;
    displayLabel: string | null;
  }[];
}): ResultRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    status: record.status as ResultRecord["status"],
    talliedAt: record.talliedAt,
    talliedById: record.talliedById,
    sourceRule: record.sourceRule,
    items: record.items.map(mapResultItem)
  });
}

function mapResultVersion(record: {
  id: string;
  electionId: string;
  resultId: string;
  versionNo: number;
  versionType: string;
  status: string;
  confirmedById: string | null;
  publishedAt: Date | null;
  notice: string | null;
}): ResultVersionRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    resultId: record.resultId,
    versionNo: record.versionNo,
    versionType: record.versionType as ResultVersionRecord["versionType"],
    status: record.status as ResultVersionRecord["status"],
    confirmedById: record.confirmedById,
    publishedAt: record.publishedAt,
    notice: record.notice
  });
}

function mapCorrection(record: {
  id: string;
  electionId: string;
  resultVersionId: string;
  status: string;
  reason: string;
  requestedById: string;
  approvedById: string | null;
  approvedAt: Date | null;
}): CorrectionRequestRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    resultVersionId: record.resultVersionId,
    status: record.status as CorrectionRequestRecord["status"],
    reason: record.reason,
    requestedById: record.requestedById,
    approvedById: record.approvedById,
    approvedAt: record.approvedAt
  });
}

function mapInvalidation(record: {
  id: string;
  electionId: string;
  resultVersionId: string | null;
  reason: string;
  requestedById: string;
  approvedById: string | null;
  approvedAt: Date | null;
  notice: string | null;
}): InvalidationRecordRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    resultVersionId: record.resultVersionId,
    reason: record.reason,
    requestedById: record.requestedById,
    approvedById: record.approvedById,
    approvedAt: record.approvedAt,
    notice: record.notice
  });
}

function mapReport(record: {
  id: string;
  electionId: string;
  resultVersionId: string;
  reportType: string;
  format: string;
  status: string;
}): ReportRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    resultVersionId: record.resultVersionId,
    reportType: record.reportType as ReportRecord["reportType"],
    format: record.format,
    status: record.status as ReportRecord["status"]
  });
}

function mapReportExport(record: {
  id: string;
  reportId: string;
  requestedById: string;
  approvedById: string | null;
  status: string;
  purpose: string;
  exportFormat: string;
  scopeSummary: Prisma.JsonValue | null;
  watermarkId: string | null;
  expiresAt: Date | null;
  downloadedAt: Date | null;
}): ReportExportRecord {
  return Object.freeze({
    id: record.id,
    reportId: record.reportId,
    requestedById: record.requestedById,
    approvedById: record.approvedById,
    status: record.status as ReportExportRecord["status"],
    purpose: record.purpose,
    exportFormat: record.exportFormat,
    scopeSummary: record.scopeSummary,
    watermarkId: record.watermarkId,
    expiresAt: record.expiresAt,
    downloadedAt: record.downloadedAt
  });
}

export class PrismaResultRepository implements ResultRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findElectionById(electionId: string): Promise<ResultElectionRecord | null> {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      select: {
        id: true,
        organizationId: true,
        votingMode: true,
        state: true,
        endsAt: true
      }
    });
    return election ? mapElection(election) : null;
  }

  async countEligibleVoters(electionId: string): Promise<number> {
    return this.prisma.eligibleVoter.count({
      where: { electionId, status: RecordStatus.active }
    });
  }

  async listQuestionsWithOptions(electionId: string): Promise<TallyQuestionRecord[]> {
    const questions = await this.prisma.question.findMany({
      where: { electionId, status: RecordStatus.active },
      orderBy: { displayOrder: "asc" },
      include: {
        options: {
          where: { status: RecordStatus.active },
          orderBy: { displayOrder: "asc" },
          select: { id: true, label: true, displayOrder: true }
        }
      }
    });
    return questions.map(mapQuestion);
  }

  async listBallotsForTally(electionId: string): Promise<TallyBallotRecord[]> {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      select: { endsAt: true }
    });
    if (!election) {
      return [];
    }
    const ballots = await this.prisma.ballot.findMany({
      where: {
        electionId,
        isCurrent: true,
        acceptanceStatus: BallotAcceptanceStatus.accepted,
        serverReceivedAt: { lte: election.endsAt }
      },
      include: {
        votes: {
          include: {
            options: { select: { optionId: true } }
          }
        }
      }
    });

    return ballots.map((ballot) =>
      Object.freeze({
        id: ballot.id,
        electionId: ballot.electionId,
        isCurrent: ballot.isCurrent,
        acceptanceStatus: ballot.acceptanceStatus as TallyBallotRecord["acceptanceStatus"],
        serverReceivedAt: ballot.serverReceivedAt,
        votes: ballot.votes.map((vote) =>
          Object.freeze({
            id: vote.id,
            questionId: vote.questionId,
            answerType: vote.answerType as TallyBallotRecord["votes"][number]["answerType"],
            optionIds: vote.options.map((option) => option.optionId),
            hasFreeText: Boolean(vote.freeTextEncrypted)
          })
        )
      })
    );
  }

  async createTalliedResult(input: Parameters<ResultRepository["createTalliedResult"]>[0]): Promise<ResultRecord> {
    const result = await this.prisma.result.create({
      data: {
        electionId: input.electionId,
        talliedById: input.talliedById,
        talliedAt: input.talliedAt,
        status: ResultStatus.tallied,
        sourceRule: input.sourceRule,
        items: {
          create: input.items.map((item) => ({
            questionId: item.questionId,
            optionId: item.optionId ?? undefined,
            voteCount: item.voteCount,
            masked: item.masked ?? false,
            displayLabel: item.displayLabel
          }))
        }
      },
      include: { items: true }
    });
    return mapResult(result);
  }

  async findLatestResult(electionId: string): Promise<ResultRecord | null> {
    const result = await this.prisma.result.findFirst({
      where: { electionId, status: ResultStatus.tallied },
      orderBy: { createdAt: "desc" },
      include: { items: true }
    });
    return result ? mapResult(result) : null;
  }

  async findResultById(resultId: string): Promise<ResultRecord | null> {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: { items: true }
    });
    return result ? mapResult(result) : null;
  }

  async createResultVersion(input: Parameters<ResultRepository["createResultVersion"]>[0]): Promise<ResultVersionRecord> {
    const latest = await this.prisma.resultVersion.aggregate({
      where: { electionId: input.electionId },
      _max: { versionNo: true }
    });
    const version = await this.prisma.resultVersion.create({
      data: {
        electionId: input.electionId,
        resultId: input.resultId,
        versionNo: (latest._max.versionNo ?? 0) + 1,
        versionType: input.versionType as ResultVersionType,
        status: input.status as ResultVersionStatus,
        confirmedById: input.confirmedById,
        notice: input.notice
      }
    });
    return mapResultVersion(version);
  }

  async findLatestResultVersion(electionId: string): Promise<ResultVersionRecord | null> {
    const version = await this.prisma.resultVersion.findFirst({
      where: { electionId },
      orderBy: { versionNo: "desc" }
    });
    return version ? mapResultVersion(version) : null;
  }

  async findPublishedResultVersion(electionId: string): Promise<ResultVersionRecord | null> {
    const version = await this.prisma.resultVersion.findFirst({
      where: { electionId, status: ResultVersionStatus.published },
      orderBy: { versionNo: "desc" }
    });
    return version ? mapResultVersion(version) : null;
  }

  async markResultVersionPublished(
    resultVersionId: string,
    publishedAt: Date,
    notice?: string
  ): Promise<ResultVersionRecord> {
    const version = await this.prisma.resultVersion.update({
      where: { id: resultVersionId },
      data: {
        status: ResultVersionStatus.published,
        publishedAt,
        ...(notice ? { notice } : {})
      }
    });
    return mapResultVersion(version);
  }

  async updateElectionState(electionId: string, state: ResultElectionRecord["state"]): Promise<void> {
    await this.prisma.election.update({
      where: { id: electionId },
      data: { state: state as ElectionState }
    });
  }

  async recordElectionStateHistory(input: ElectionStateHistoryInput): Promise<void> {
    await this.prisma.electionStateHistory.create({
      data: {
        electionId: input.electionId,
        fromState: input.fromState as ElectionState | undefined,
        toState: input.toState as ElectionState,
        requestedById: input.requestedById,
        approvedById: input.approvedById,
        reason: input.reason,
        changeType: input.changeType,
        changedAt: input.changedAt
      }
    });
  }

  async createCorrectionRequest(input: Parameters<ResultRepository["createCorrectionRequest"]>[0]): Promise<CorrectionRequestRecord> {
    const correction = await this.prisma.correctionRequest.create({
      data: input
    });
    return mapCorrection(correction);
  }

  async findCorrectionRequest(correctionId: string): Promise<CorrectionRequestRecord | null> {
    const correction = await this.prisma.correctionRequest.findUnique({
      where: { id: correctionId }
    });
    return correction ? mapCorrection(correction) : null;
  }

  async approveCorrectionRequest(input: Parameters<ResultRepository["approveCorrectionRequest"]>[0]): Promise<CorrectionRequestRecord> {
    const correction = await this.prisma.correctionRequest.update({
      where: { id: input.correctionId },
      data: {
        status: "approved",
        approvedById: input.approvedById,
        approvedAt: input.approvedAt
      }
    });
    return mapCorrection(correction);
  }

  async createInvalidationRecord(input: Parameters<ResultRepository["createInvalidationRecord"]>[0]): Promise<InvalidationRecordRecord> {
    const invalidation = await this.prisma.invalidationRecord.create({
      data: input
    });
    return mapInvalidation(invalidation);
  }

  async findReport(reportId: string): Promise<ReportRecord | null> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    return report ? mapReport(report) : null;
  }

  async createReportForResultVersion(input: Parameters<ResultRepository["createReportForResultVersion"]>[0]): Promise<ReportRecord> {
    const report = await this.prisma.report.create({
      data: {
        electionId: input.electionId,
        resultVersionId: input.resultVersionId,
        reportType: input.reportType as ReportType,
        format: input.format,
        status: ExportStatus.requested,
        generatedById: input.generatedById
      }
    });
    return mapReport(report);
  }

  async createReportExport(input: Parameters<ResultRepository["createReportExport"]>[0]): Promise<ReportExportRecord> {
    const reportExport = await this.prisma.reportExport.create({
      data: {
        reportId: input.reportId,
        requestedById: input.requestedById,
        purpose: input.purpose,
        exportFormat: input.exportFormat,
        scopeSummary: input.scopeSummary as Prisma.InputJsonValue | undefined,
        expiresAt: input.expiresAt,
        status: ExportStatus.requested
      }
    });
    return mapReportExport(reportExport);
  }

  async findReportExport(exportId: string): Promise<ReportExportRecord | null> {
    const reportExport = await this.prisma.reportExport.findUnique({ where: { id: exportId } });
    return reportExport ? mapReportExport(reportExport) : null;
  }

  async markReportExportDownloaded(exportId: string, downloadedAt: Date): Promise<ReportExportRecord> {
    const reportExport = await this.prisma.reportExport.update({
      where: { id: exportId },
      data: {
        status: ExportStatus.downloaded,
        downloadedAt
      }
    });
    return mapReportExport(reportExport);
  }
}

export function createPrismaResultRepository(prisma: PrismaClientLike): ResultRepository {
  return new PrismaResultRepository(prisma);
}
