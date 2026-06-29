import type { AuthenticationMethodValue } from "../../domain/auth-policy/authentication-policy";
import type { VoterSession } from "../auth/voter-session";
import type { SecurityEventInput } from "../audit/security-event";

export type InvitationStatusValue =
  | "pending"
  | "sent"
  | "opened"
  | "expired"
  | "revoked"
  | "failed";
export type CredentialStatusValue = "active" | "locked" | "revoked" | "expired";
export type AuthStatusValue =
  | "not_started"
  | "identifier_verified"
  | "code_pending"
  | "authenticated"
  | "failed";

export type InvitationAuthRecord = Readonly<{
  id: string;
  electionId: string;
  eligibleVoterId: string;
  votingCredentialId: string;
  inviteTokenHash: string;
  status: InvitationStatusValue;
  expiresAt: Date;
  authenticationMethod: AuthenticationMethodValue;
}>;

export type AuthenticationPolicyRecord = Readonly<{
  electionId: string;
  method: AuthenticationMethodValue;
  isEnabled: boolean;
  isPaidMethod: boolean;
  provider?: string | null;
}>;

export type VotingCredentialAuthRecord = Readonly<{
  id: string;
  electionId: string;
  eligibleVoterId: string;
  credentialStatus: CredentialStatusValue;
  authStatus: AuthStatusValue;
  identifierFailedAttempts: number;
  lockedUntil?: Date | null;
  externalIdentifierHmac: string;
  hasVoted: boolean;
}>;

export type CredentialEventInput = Readonly<{
  electionId: string;
  votingCredentialId: string;
  eventType: string;
  method: AuthenticationMethodValue;
  channel?: string;
  provider?: string;
  success?: boolean;
  failureReasonCode?: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}>;

export type CredentialUpdateCommand = Readonly<{
  votingCredentialId: string;
  authStatus?: AuthStatusValue;
  credentialStatus?: CredentialStatusValue;
  identifierFailedAttempts?: number;
  lockedUntil?: Date | null;
  authenticatedAt?: Date;
}>;

export type VoterSessionRecord = VoterSession & Readonly<{
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
}>;

export type VoterSessionCreateCommand = VoterSession;

export type VoterSessionAuthenticationCommand = Readonly<{
  handleHash: string;
  authenticated: boolean;
  identifierVerifiedAt?: Date;
  step: AuthStatusValue;
}>;

export type VoterAuthRepository = {
  findInvitationByTokenHash(tokenHash: string): Promise<InvitationAuthRecord | null>;
  findAuthenticationPolicy(electionId: string): Promise<AuthenticationPolicyRecord | null>;
  findVotingCredential(id: string): Promise<VotingCredentialAuthRecord | null>;
  updateVotingCredential(command: CredentialUpdateCommand): Promise<void>;
  recordCredentialEvent(event: CredentialEventInput): Promise<void>;
  recordSecurityEvent?(event: SecurityEventInput): Promise<void>;
  createVoterSessionRecord(session: VoterSessionCreateCommand): Promise<void>;
  storeVoterSession(session: VoterSessionCreateCommand): Promise<void>;
  findVoterSessionByHandleHash(handleHash: string, now?: Date): Promise<VoterSessionRecord | null>;
  updateVoterSessionAuthentication(command: VoterSessionAuthenticationCommand): Promise<void>;
  revokeVoterSession(handleHash: string, revokedAt?: Date): Promise<void>;
  touchVoterSession(handleHash: string, touchedAt?: Date): Promise<void>;
};
