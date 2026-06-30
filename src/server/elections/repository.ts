import type { AuthenticationMethodValue } from "../../domain/auth-policy/authentication-policy";
import type { ElectionStateValue } from "../../domain/elections/state-machine";
import type {
  AuthenticationPolicyInput,
  ElectionDraftInput,
  ElectionDraftUpdateInput,
  OptionInput,
  OptionUpdateInput,
  QuestionInput,
  QuestionUpdateInput
} from "./validation";

export type ElectionTypeValue =
  | "representative_election"
  | "yes_no_agenda"
  | "multiple_choice_agenda"
  | "opinion_collection";
export type VotingModeValue = "anonymous" | "named";
export type QuestionTypeValue = "single_choice" | "multiple_choice" | "yes_no" | "free_text";
export type RecordStatusValue = "active" | "disabled" | "archived";
export type RegistryStatusValue = "draft" | "imported" | "validated" | "confirmed" | "locked";
export type ImportStatusValue = "uploaded" | "validating" | "validated" | "failed";
export type ValidationErrorTypeValue =
  | "missing_required"
  | "duplicate"
  | "invalid_format"
  | "conflict";
export type InvitationStatusValue = "pending" | "sent" | "failed" | "opened" | "expired" | "revoked";
export type NotificationChannelValue = "app" | "email" | "sms" | "kakao";
export type CredentialStatusValue = "active" | "locked" | "revoked" | "expired";
export type AuthStatusValue =
  | "not_started"
  | "identifier_verified"
  | "code_pending"
  | "authenticated"
  | "failed";
export type DeliveryStatusValue = "pending" | "sent" | "failed" | "suppressed";

export type ElectionRecord = Readonly<{
  id: string;
  organizationId: string;
  createdById?: string | null;
  title: string;
  description?: string | null;
  electionType: ElectionTypeValue;
  votingMode: VotingModeValue;
  state: ElectionStateValue;
  noticeStartsAt?: Date | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  deletedAt?: Date | null;
  deletionReason?: string | null;
}>;

export type QuestionRecord = Readonly<{
  id: string;
  electionId: string;
  title: string;
  description?: string | null;
  questionType: QuestionTypeValue;
  required: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
  displayOrder: number;
  status: RecordStatusValue;
}>;

export type OptionRecord = Readonly<{
  id: string;
  questionId: string;
  label: string;
  description?: string | null;
  displayOrder: number;
  status: RecordStatusValue;
}>;

export type AuthenticationPolicyRecord = Readonly<{
  electionId: string;
  method: AuthenticationMethodValue;
  isEnabled: boolean;
  isPaidMethod: boolean;
  provider?: string | null;
  securityLevel: string;
  identifierFields?: unknown;
  codeChannel?: string | null;
  codeTtlMinutes?: number | null;
  maxCodeResends?: number | null;
}>;

export type VoterRegistryRecord = Readonly<{
  id: string;
  electionId: string;
  status: RegistryStatusValue;
  sourceType: string;
  totalRows: number;
  validRows: number;
}>;

export type EligibleVoterCreateInput = Readonly<{
  electionId: string;
  voterRegistryId: string;
  nameEncrypted?: string;
  emailEncrypted?: string;
  phoneEncrypted?: string;
  externalIdentifierEncrypted?: string;
  externalIdentifierHmac: string;
  searchHmac?: string;
}>;

export type EligibleVoterRecord = EligibleVoterCreateInput & Readonly<{
  id: string;
  status: RecordStatusValue;
}>;

export type VoterRegistryImportRecord = Readonly<{
  id: string;
  voterRegistryId: string;
  importStatus: ImportStatusValue;
  rowCount: number;
}>;

export type InvitationRecord = Readonly<{
  id: string;
  electionId: string;
  eligibleVoterId: string;
  inviteTokenHash: string;
  channel: NotificationChannelValue;
  status: InvitationStatusValue;
  sentAt?: Date | null;
  lastSentAt?: Date | null;
  sendCount: number;
  expiresAt: Date;
}>;

export type InvitationCreateInput = Readonly<{
  electionId: string;
  eligibleVoterId: string;
  inviteTokenHash: string;
  channel: NotificationChannelValue;
  expiresAt: Date;
}>;

export type VotingCredentialRecord = Readonly<{
  id: string;
  electionId: string;
  eligibleVoterId: string;
  credentialStatus: CredentialStatusValue;
  authStatus: AuthStatusValue;
}>;

export type VotingCredentialCreateInput = Readonly<{
  electionId: string;
  eligibleVoterId: string;
  credentialStatus: CredentialStatusValue;
  authStatus: AuthStatusValue;
}>;

export type DeliveryEventInput = Readonly<{
  organizationId: string;
  electionId?: string;
  recipientType: string;
  recipientRefId?: string;
  channel: NotificationChannelValue;
  deliveryType: string;
  status: DeliveryStatusValue;
  provider?: string;
  sentAt?: Date;
  failedAt?: Date;
  failureReasonCode?: string;
}>;

export type ValidationErrorInput = Readonly<{
  importId: string;
  rowNumber?: number;
  fieldName?: string;
  errorType: ValidationErrorTypeValue;
  message?: string;
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

export type ElectionChangeHistoryInput = Readonly<{
  electionId: string;
  changedArea: string;
  beforeSummary?: Record<string, unknown>;
  afterSummary?: Record<string, unknown>;
  changedById: string;
  changedAt: Date;
}>;

export type ElectionRepository = {
  createElectionDraft(input: ElectionDraftInput & {
    organizationId: string;
    createdById: string;
  }): Promise<ElectionRecord>;
  findElectionById(electionId: string): Promise<ElectionRecord | null>;
  listElections(organizationId: string): Promise<ElectionRecord[]>;
  updateElectionDraft(
    electionId: string,
    input: ElectionDraftUpdateInput
  ): Promise<ElectionRecord>;
  updateElectionState(
    electionId: string,
    state: ElectionStateValue,
    updates?: { startsAt?: Date }
  ): Promise<void>;
  softDeleteElection(input: {
    electionId: string;
    deletedAt: Date;
    deletionReason?: string;
  }): Promise<void>;

  createQuestion(electionId: string, input: QuestionInput): Promise<QuestionRecord>;
  updateQuestion(questionId: string, input: QuestionUpdateInput): Promise<QuestionRecord>;
  createOption(questionId: string, input: OptionInput): Promise<OptionRecord>;
  updateOption(optionId: string, input: OptionUpdateInput): Promise<OptionRecord>;
  findQuestionById(questionId: string): Promise<QuestionRecord | null>;
  findOptionById(optionId: string): Promise<OptionRecord | null>;

  upsertAuthenticationPolicy(
    electionId: string,
    input: AuthenticationPolicyInput & {
      isPaidMethod: boolean;
      securityLevel: string;
    }
  ): Promise<AuthenticationPolicyRecord>;

  createOrGetVoterRegistry(electionId: string, sourceType: string): Promise<VoterRegistryRecord>;
  findVoterRegistryByElectionId(electionId: string): Promise<VoterRegistryRecord | null>;
  createVoterRegistryImport(input: {
    voterRegistryId: string;
    fileName?: string;
    fileHash?: string;
    rowCount: number;
    importStatus: ImportStatusValue;
  }): Promise<VoterRegistryImportRecord>;
  updateVoterRegistryCounts(input: {
    voterRegistryId: string;
    status: RegistryStatusValue;
    totalRows: number;
    validRows: number;
  }): Promise<void>;
  findEligibleVoterByExternalIdentifierHmac(
    electionId: string,
    externalIdentifierHmac: string
  ): Promise<EligibleVoterRecord | null>;
  createEligibleVoter(input: EligibleVoterCreateInput): Promise<EligibleVoterRecord>;
  createValidationErrors(errors: ValidationErrorInput[]): Promise<void>;

  listEligibleVotersForElection(electionId: string): Promise<EligibleVoterRecord[]>;
  findInvitationByEligibleVoterId(
    electionId: string,
    eligibleVoterId: string
  ): Promise<InvitationRecord | null>;
  createInvitation(input: InvitationCreateInput): Promise<InvitationRecord>;
  markInvitationSent(input: {
    invitationId: string;
    channel: NotificationChannelValue;
    sentAt: Date;
  }): Promise<InvitationRecord>;
  findVotingCredentialByEligibleVoterId(
    electionId: string,
    eligibleVoterId: string
  ): Promise<VotingCredentialRecord | null>;
  createVotingCredential(input: VotingCredentialCreateInput): Promise<VotingCredentialRecord>;
  recordDeliveryEvent(input: DeliveryEventInput): Promise<void>;

  recordElectionStateHistory(input: ElectionStateHistoryInput): Promise<void>;
  recordElectionChangeHistory(input: ElectionChangeHistoryInput): Promise<void>;
};
