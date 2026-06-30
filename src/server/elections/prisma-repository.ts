import {
  AuthStatus,
  AuthenticationMethod as PrismaAuthenticationMethod,
  CredentialStatus,
  DeliveryStatus,
  ElectionState,
  ElectionType,
  ImportStatus,
  InvitationStatus,
  NotificationChannel,
  Prisma,
  QuestionType,
  RecordStatus,
  RegistryStatus,
  ValidationErrorType,
  VotingMode
} from "@prisma/client";

import type { AuthenticationMethodValue } from "../../domain/auth-policy/authentication-policy";
import type { ElectionStateValue } from "../../domain/elections/state-machine";
import type { PrismaClientLike } from "../db/prisma";
import { redactSensitiveValues } from "../privacy/redaction";
import type {
  AuthenticationPolicyRecord,
  ElectionRecord,
  ElectionRepository,
  DeliveryEventInput,
  EligibleVoterCreateInput,
  EligibleVoterRecord,
  ImportStatusValue,
  InvitationCreateInput,
  InvitationRecord,
  OptionRecord,
  QuestionRecord,
  RegistryStatusValue,
  ValidationErrorInput,
  VotingCredentialCreateInput,
  VotingCredentialRecord,
  VoterRegistryImportRecord,
  VoterRegistryRecord
} from "./repository";
import type {
  AuthenticationPolicyInput,
  ElectionDraftInput,
  ElectionDraftUpdateInput,
  OptionInput,
  OptionUpdateInput,
  QuestionInput,
  QuestionUpdateInput
} from "./validation";

function mapElection(record: {
  id: string;
  organizationId: string;
  createdById: string | null;
  title: string;
  description: string | null;
  electionType: string;
  votingMode: string;
  state: string;
  noticeStartsAt: Date | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  deletedAt?: Date | null;
  deletionReason?: string | null;
}): ElectionRecord {
  return Object.freeze({
    id: record.id,
    organizationId: record.organizationId,
    createdById: record.createdById,
    title: record.title,
    description: record.description,
    electionType: record.electionType as ElectionRecord["electionType"],
    votingMode: record.votingMode as ElectionRecord["votingMode"],
    state: record.state as ElectionStateValue,
    noticeStartsAt: record.noticeStartsAt,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    timezone: record.timezone,
    deletedAt: record.deletedAt,
    deletionReason: record.deletionReason
  });
}

function mapQuestion(record: {
  id: string;
  electionId: string;
  title: string;
  description: string | null;
  questionType: string;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  displayOrder: number;
  status: string;
}): QuestionRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    title: record.title,
    description: record.description,
    questionType: record.questionType as QuestionRecord["questionType"],
    required: record.required,
    minSelect: record.minSelect,
    maxSelect: record.maxSelect,
    displayOrder: record.displayOrder,
    status: record.status as QuestionRecord["status"]
  });
}

function mapOption(record: {
  id: string;
  questionId: string;
  label: string;
  description: string | null;
  displayOrder: number;
  status: string;
}): OptionRecord {
  return Object.freeze({
    id: record.id,
    questionId: record.questionId,
    label: record.label,
    description: record.description,
    displayOrder: record.displayOrder,
    status: record.status as OptionRecord["status"]
  });
}

function mapVoterRegistry(record: {
  id: string;
  electionId: string;
  status: string;
  sourceType: string;
  totalRows: number;
  validRows: number;
}): VoterRegistryRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    status: record.status as RegistryStatusValue,
    sourceType: record.sourceType,
    totalRows: record.totalRows,
    validRows: record.validRows
  });
}

function mapEligibleVoter(record: {
  id: string;
  electionId: string;
  voterRegistryId: string;
  nameEncrypted: string | null;
  emailEncrypted: string | null;
  phoneEncrypted: string | null;
  externalIdentifierEncrypted: string | null;
  externalIdentifierHmac: string;
  searchHmac: string | null;
  status: string;
}): EligibleVoterRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    voterRegistryId: record.voterRegistryId,
    nameEncrypted: record.nameEncrypted ?? undefined,
    emailEncrypted: record.emailEncrypted ?? undefined,
    phoneEncrypted: record.phoneEncrypted ?? undefined,
    externalIdentifierEncrypted: record.externalIdentifierEncrypted ?? undefined,
    externalIdentifierHmac: record.externalIdentifierHmac,
    searchHmac: record.searchHmac ?? undefined,
    status: record.status as EligibleVoterRecord["status"]
  });
}

function mapInvitation(record: {
  id: string;
  electionId: string;
  eligibleVoterId: string;
  inviteTokenHash: string;
  channel: string;
  status: string;
  sentAt: Date | null;
  lastSentAt: Date | null;
  sendCount: number;
  expiresAt: Date;
}): InvitationRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    eligibleVoterId: record.eligibleVoterId,
    inviteTokenHash: record.inviteTokenHash,
    channel: record.channel as InvitationRecord["channel"],
    status: record.status as InvitationRecord["status"],
    sentAt: record.sentAt,
    lastSentAt: record.lastSentAt,
    sendCount: record.sendCount,
    expiresAt: record.expiresAt
  });
}

function mapVotingCredential(record: {
  id: string;
  electionId: string;
  eligibleVoterId: string;
  credentialStatus: string;
  authStatus: string;
}): VotingCredentialRecord {
  return Object.freeze({
    id: record.id,
    electionId: record.electionId,
    eligibleVoterId: record.eligibleVoterId,
    credentialStatus: record.credentialStatus as VotingCredentialRecord["credentialStatus"],
    authStatus: record.authStatus as VotingCredentialRecord["authStatus"]
  });
}

export class PrismaElectionRepository implements ElectionRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async createElectionDraft(
    input: ElectionDraftInput & { organizationId: string; createdById: string }
  ): Promise<ElectionRecord> {
    const election = await this.prisma.election.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        title: input.title,
        description: input.description,
        electionType: input.electionType as ElectionType,
        votingMode: input.votingMode as VotingMode,
        noticeStartsAt: input.noticeStartsAt,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone
      }
    });
    return mapElection(election);
  }

  async findElectionById(electionId: string): Promise<ElectionRecord | null> {
    const election = await this.prisma.election.findUnique({ where: { id: electionId } });
    return election ? mapElection(election) : null;
  }

  async listElections(organizationId: string): Promise<ElectionRecord[]> {
    const elections = await this.prisma.election.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    return elections.map(mapElection);
  }

  async updateElectionDraft(
    electionId: string,
    input: ElectionDraftUpdateInput
  ): Promise<ElectionRecord> {
    const election = await this.prisma.election.update({
      where: { id: electionId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.electionType !== undefined
          ? { electionType: input.electionType as ElectionType }
          : {}),
        ...(input.votingMode !== undefined ? { votingMode: input.votingMode as VotingMode } : {}),
        ...(input.noticeStartsAt !== undefined ? { noticeStartsAt: input.noticeStartsAt } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {})
      }
    });
    return mapElection(election);
  }

  async updateElectionState(
    electionId: string,
    state: ElectionStateValue,
    updates: { startsAt?: Date } = {}
  ): Promise<void> {
    await this.prisma.election.update({
      where: { id: electionId },
      data: {
        state: state as ElectionState,
        ...(updates.startsAt !== undefined ? { startsAt: updates.startsAt } : {})
      }
    });
  }

  async softDeleteElection(input: Parameters<ElectionRepository["softDeleteElection"]>[0]): Promise<void> {
    await this.prisma.election.update({
      where: { id: input.electionId },
      data: {
        deletedAt: input.deletedAt,
        deletionReason: input.deletionReason
      }
    });
  }

  async createQuestion(electionId: string, input: QuestionInput): Promise<QuestionRecord> {
    const question = await this.prisma.question.create({
      data: {
        electionId,
        title: input.title,
        description: input.description,
        questionType: input.questionType as QuestionType,
        required: input.required,
        minSelect: input.minSelect,
        maxSelect: input.maxSelect,
        displayOrder: input.displayOrder
      }
    });
    return mapQuestion(question);
  }

  async updateQuestion(questionId: string, input: QuestionUpdateInput): Promise<QuestionRecord> {
    const question = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.questionType !== undefined
          ? { questionType: input.questionType as QuestionType }
          : {}),
        ...(input.required !== undefined ? { required: input.required } : {}),
        ...(input.minSelect !== undefined ? { minSelect: input.minSelect } : {}),
        ...(input.maxSelect !== undefined ? { maxSelect: input.maxSelect } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {})
      }
    });
    return mapQuestion(question);
  }

  async createOption(questionId: string, input: OptionInput): Promise<OptionRecord> {
    const option = await this.prisma.option.create({
      data: {
        questionId,
        label: input.label,
        description: input.description,
        displayOrder: input.displayOrder
      }
    });
    return mapOption(option);
  }

  async updateOption(optionId: string, input: OptionUpdateInput): Promise<OptionRecord> {
    const option = await this.prisma.option.update({
      where: { id: optionId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {})
      }
    });
    return mapOption(option);
  }

  async findQuestionById(questionId: string): Promise<QuestionRecord | null> {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    return question ? mapQuestion(question) : null;
  }

  async findOptionById(optionId: string): Promise<OptionRecord | null> {
    const option = await this.prisma.option.findUnique({ where: { id: optionId } });
    return option ? mapOption(option) : null;
  }

  async upsertAuthenticationPolicy(
    electionId: string,
    input: AuthenticationPolicyInput & { isPaidMethod: boolean; securityLevel: string }
  ): Promise<AuthenticationPolicyRecord> {
    const policy = await this.prisma.authenticationPolicy.upsert({
      where: { electionId },
      create: {
        electionId,
        method: input.method as PrismaAuthenticationMethod,
        isEnabled: input.isEnabled,
        isPaidMethod: input.isPaidMethod,
        provider: input.provider,
        securityLevel: input.securityLevel,
        identifierFields: input.identifierFields as Prisma.InputJsonValue,
        codeChannel: input.codeChannel,
        codeTtlMinutes: input.codeTtlMinutes,
        maxCodeResends: input.maxCodeResends
      },
      update: {
        method: input.method as PrismaAuthenticationMethod,
        isEnabled: input.isEnabled,
        isPaidMethod: input.isPaidMethod,
        provider: input.provider,
        securityLevel: input.securityLevel,
        identifierFields: input.identifierFields as Prisma.InputJsonValue,
        codeChannel: input.codeChannel,
        codeTtlMinutes: input.codeTtlMinutes,
        maxCodeResends: input.maxCodeResends
      }
    });
    return Object.freeze({
      electionId: policy.electionId,
      method: policy.method as AuthenticationMethodValue,
      isEnabled: policy.isEnabled,
      isPaidMethod: policy.isPaidMethod,
      provider: policy.provider,
      securityLevel: policy.securityLevel,
      identifierFields: policy.identifierFields,
      codeChannel: policy.codeChannel,
      codeTtlMinutes: policy.codeTtlMinutes,
      maxCodeResends: policy.maxCodeResends
    });
  }

  async createOrGetVoterRegistry(
    electionId: string,
    sourceType: string
  ): Promise<VoterRegistryRecord> {
    const registry = await this.prisma.voterRegistry.upsert({
      where: { electionId },
      create: { electionId, sourceType },
      update: { sourceType }
    });
    return mapVoterRegistry(registry);
  }

  async findVoterRegistryByElectionId(
    electionId: string
  ): Promise<VoterRegistryRecord | null> {
    const registry = await this.prisma.voterRegistry.findUnique({ where: { electionId } });
    return registry ? mapVoterRegistry(registry) : null;
  }

  async createVoterRegistryImport(input: {
    voterRegistryId: string;
    fileName?: string;
    fileHash?: string;
    rowCount: number;
    importStatus: ImportStatusValue;
  }): Promise<VoterRegistryImportRecord> {
    const record = await this.prisma.voterRegistryImport.create({
      data: {
        voterRegistryId: input.voterRegistryId,
        fileName: input.fileName,
        fileHash: input.fileHash,
        rowCount: input.rowCount,
        importStatus: input.importStatus as ImportStatus
      }
    });
    return Object.freeze({
      id: record.id,
      voterRegistryId: record.voterRegistryId,
      importStatus: record.importStatus as ImportStatusValue,
      rowCount: record.rowCount
    });
  }

  async updateVoterRegistryCounts(input: {
    voterRegistryId: string;
    status: RegistryStatusValue;
    totalRows: number;
    validRows: number;
  }): Promise<void> {
    await this.prisma.voterRegistry.update({
      where: { id: input.voterRegistryId },
      data: {
        status: input.status as RegistryStatus,
        totalRows: input.totalRows,
        validRows: input.validRows
      }
    });
  }

  async findEligibleVoterByExternalIdentifierHmac(
    electionId: string,
    externalIdentifierHmac: string
  ): Promise<EligibleVoterRecord | null> {
    const voter = await this.prisma.eligibleVoter.findUnique({
      where: {
        electionId_externalIdentifierHmac: {
          electionId,
          externalIdentifierHmac
        }
      }
    });
    return voter ? mapEligibleVoter(voter) : null;
  }

  async createEligibleVoter(input: EligibleVoterCreateInput): Promise<EligibleVoterRecord> {
    const voter = await this.prisma.eligibleVoter.create({
      data: {
        electionId: input.electionId,
        voterRegistryId: input.voterRegistryId,
        nameEncrypted: input.nameEncrypted,
        emailEncrypted: input.emailEncrypted,
        phoneEncrypted: input.phoneEncrypted,
        externalIdentifierEncrypted: input.externalIdentifierEncrypted,
        externalIdentifierHmac: input.externalIdentifierHmac,
        searchHmac: input.searchHmac,
        status: RecordStatus.active
      }
    });
    return mapEligibleVoter(voter);
  }

  async createValidationErrors(errors: ValidationErrorInput[]): Promise<void> {
    if (errors.length === 0) {
      return;
    }
    await this.prisma.voterRegistryValidationError.createMany({
      data: errors.map((error) => ({
        importId: error.importId,
        rowNumber: error.rowNumber,
        fieldName: error.fieldName,
        errorType: error.errorType as ValidationErrorType,
        message: error.message
      }))
    });
  }

  async listEligibleVotersForElection(electionId: string): Promise<EligibleVoterRecord[]> {
    const voters = await this.prisma.eligibleVoter.findMany({
      where: { electionId, status: RecordStatus.active },
      orderBy: { createdAt: "asc" }
    });
    return voters.map(mapEligibleVoter);
  }

  async findInvitationByEligibleVoterId(
    electionId: string,
    eligibleVoterId: string
  ): Promise<InvitationRecord | null> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { electionId, eligibleVoterId },
      orderBy: { createdAt: "desc" }
    });
    return invitation ? mapInvitation(invitation) : null;
  }

  async createInvitation(input: InvitationCreateInput): Promise<InvitationRecord> {
    const invitation = await this.prisma.invitation.create({
      data: {
        electionId: input.electionId,
        eligibleVoterId: input.eligibleVoterId,
        inviteTokenHash: input.inviteTokenHash,
        channel: input.channel as NotificationChannel,
        expiresAt: input.expiresAt
      }
    });
    return mapInvitation(invitation);
  }

  async markInvitationSent(input: {
    invitationId: string;
    channel: InvitationRecord["channel"];
    sentAt: Date;
  }): Promise<InvitationRecord> {
    const invitation = await this.prisma.invitation.update({
      where: { id: input.invitationId },
      data: {
        channel: input.channel as NotificationChannel,
        status: InvitationStatus.sent,
        sentAt: input.sentAt,
        lastSentAt: input.sentAt,
        sendCount: { increment: 1 }
      }
    });
    return mapInvitation(invitation);
  }

  async findVotingCredentialByEligibleVoterId(
    electionId: string,
    eligibleVoterId: string
  ): Promise<VotingCredentialRecord | null> {
    const credential = await this.prisma.votingCredential.findUnique({
      where: {
        electionId_eligibleVoterId: {
          electionId,
          eligibleVoterId
        }
      }
    });
    return credential ? mapVotingCredential(credential) : null;
  }

  async createVotingCredential(
    input: VotingCredentialCreateInput
  ): Promise<VotingCredentialRecord> {
    const credential = await this.prisma.votingCredential.create({
      data: {
        electionId: input.electionId,
        eligibleVoterId: input.eligibleVoterId,
        credentialStatus: input.credentialStatus as CredentialStatus,
        authStatus: input.authStatus as AuthStatus
      }
    });
    return mapVotingCredential(credential);
  }

  async recordDeliveryEvent(input: DeliveryEventInput): Promise<void> {
    await this.prisma.deliveryEvent.create({
      data: {
        organizationId: input.organizationId,
        electionId: input.electionId,
        recipientType: input.recipientType,
        recipientRefId: input.recipientRefId,
        channel: input.channel as NotificationChannel,
        deliveryType: input.deliveryType,
        status: input.status as DeliveryStatus,
        provider: input.provider,
        sentAt: input.sentAt,
        failedAt: input.failedAt,
        failureReasonCode: input.failureReasonCode
      }
    });
  }

  async recordElectionStateHistory(input: Parameters<ElectionRepository["recordElectionStateHistory"]>[0]): Promise<void> {
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

  async recordElectionChangeHistory(input: Parameters<ElectionRepository["recordElectionChangeHistory"]>[0]): Promise<void> {
    await this.prisma.electionChangeHistory.create({
      data: {
        electionId: input.electionId,
        changedArea: input.changedArea,
        beforeSummary: input.beforeSummary
          ? (redactSensitiveValues(input.beforeSummary) as Prisma.InputJsonValue)
          : undefined,
        afterSummary: input.afterSummary
          ? (redactSensitiveValues(input.afterSummary) as Prisma.InputJsonValue)
          : undefined,
        changedById: input.changedById,
        changedAt: input.changedAt
      }
    });
  }
}

export function createPrismaElectionRepository(prisma: PrismaClientLike): ElectionRepository {
  return new PrismaElectionRepository(prisma);
}
