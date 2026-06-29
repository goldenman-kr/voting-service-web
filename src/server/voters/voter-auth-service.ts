import { createHmac, timingSafeEqual } from "node:crypto";

import {
  AuthenticationMethod,
  CredentialEventType
} from "../../guardrails/index.js";
import {
  getDefaultAuthenticationMethod,
  requiresIdentifier,
  requiresOneTimeCode,
  type AuthenticationMethodValue
} from "../../domain/auth-policy/authentication-policy";
import { createAuthenticationError, createForbiddenError } from "../http/errors";
import { redactSensitiveValues } from "../privacy/redaction";
import { createVoterSession } from "../auth/voter-session";
import type {
  CredentialEventInput,
  InvitationAuthRecord,
  VerifyIdentifierResult,
  VerifyInvitationTokenResult,
  VoterAuthRepository,
  VotingCredentialAuthRecord
} from "./types";

export const IDENTIFIER_LOCK_POLICY = Object.freeze({
  maxFailedAttempts: 5,
  lockMinutes: 15
});

export function hashInviteToken(inviteToken: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(inviteToken).digest("hex");
}

export function hashVoterIdentifier(identifier: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(normalizeIdentifier(identifier)).digest("hex");
}

export function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function genericAuthError(internalReason: string) {
  return createAuthenticationError(internalReason);
}

export function buildCredentialEvent({
  electionId,
  votingCredentialId,
  eventType,
  method,
  success,
  failureReasonCode,
  metadata,
  occurredAt = new Date()
}: Omit<CredentialEventInput, "occurredAt"> & { occurredAt?: Date }): CredentialEventInput {
  return Object.freeze({
    electionId,
    votingCredentialId,
    eventType,
    method,
    success,
    failureReasonCode,
    occurredAt,
    metadata: metadata ? redactSensitiveValues(metadata) : undefined
  });
}

export function buildInvitationTokenVerifiedEvent(
  invitation: InvitationAuthRecord,
  occurredAt = new Date()
): CredentialEventInput {
  return buildCredentialEvent({
    electionId: invitation.electionId,
    votingCredentialId: invitation.votingCredentialId,
    eventType: CredentialEventType.INVITE_TOKEN_VERIFIED,
    method: invitation.authenticationMethod,
    success: true,
    occurredAt
  });
}

export function buildInvitationTokenFailedEvent({
  electionId = "unknown",
  votingCredentialId = "unknown",
  method = getDefaultAuthenticationMethod(),
  failureReasonCode,
  occurredAt = new Date()
}: {
  electionId?: string;
  votingCredentialId?: string;
  method?: AuthenticationMethodValue;
  failureReasonCode: string;
  occurredAt?: Date;
}): CredentialEventInput {
  return buildCredentialEvent({
    electionId,
    votingCredentialId,
    eventType: CredentialEventType.INVITE_TOKEN_FAILED,
    method,
    success: false,
    failureReasonCode,
    occurredAt
  });
}

export async function verifyInvitationToken({
  inviteToken,
  hmacKey,
  repository,
  now = new Date(),
  sessionTtlMinutes = 15
}: {
  inviteToken: string;
  hmacKey: string;
  repository: VoterAuthRepository;
  now?: Date;
  sessionTtlMinutes?: number;
}): Promise<VerifyInvitationTokenResult> {
  const inviteTokenHash = hashInviteToken(inviteToken, hmacKey);
  const invitation = await repository.findInvitationByTokenHash(inviteTokenHash);

  if (!invitation) {
    throw genericAuthError("invite token not found");
  }
  if (invitation.status === "expired" || invitation.status === "revoked" || invitation.expiresAt <= now) {
    await repository.recordCredentialEvent(
      buildInvitationTokenFailedEvent({
        electionId: invitation.electionId,
        votingCredentialId: invitation.votingCredentialId,
        method: invitation.authenticationMethod,
        failureReasonCode: "invite_token_expired_or_revoked",
        occurredAt: now
      })
    );
    throw genericAuthError("invite token expired or revoked");
  }

  const issued = createVoterSession({
    electionId: invitation.electionId,
    eligibleVoterId: invitation.eligibleVoterId,
    votingCredentialId: invitation.votingCredentialId,
    authenticationMethod: invitation.authenticationMethod,
    hmacKey,
    now,
    ttlMinutes: sessionTtlMinutes
  });

  await repository.storeVoterSession(issued.session);
  await repository.recordCredentialEvent(buildInvitationTokenVerifiedEvent(invitation, now));

  return Object.freeze({
    voterSession: issued.session,
    opaqueHandle: issued.opaqueHandle,
    authenticationMethod: invitation.authenticationMethod,
    requiresIdentifier: requiresIdentifier(invitation.authenticationMethod),
    requiresOneTimeCode: requiresOneTimeCode(invitation.authenticationMethod)
  });
}

export function isCredentialLocked(
  credential: VotingCredentialAuthRecord,
  now = new Date()
): boolean {
  return credential.credentialStatus === "locked" && Boolean(credential.lockedUntil && credential.lockedUntil > now);
}

export function buildIdentifierVerificationSuccessEvent({
  credential,
  method,
  occurredAt = new Date()
}: {
  credential: VotingCredentialAuthRecord;
  method: AuthenticationMethodValue;
  occurredAt?: Date;
}): CredentialEventInput {
  return buildCredentialEvent({
    electionId: credential.electionId,
    votingCredentialId: credential.id,
    eventType: CredentialEventType.IDENTIFIER_CHECK_SUCCESS,
    method,
    success: true,
    occurredAt
  });
}

export function buildIdentifierVerificationFailureEvent({
  credential,
  method,
  failureReasonCode,
  occurredAt = new Date()
}: {
  credential: VotingCredentialAuthRecord;
  method: AuthenticationMethodValue;
  failureReasonCode: string;
  occurredAt?: Date;
}): CredentialEventInput {
  return buildCredentialEvent({
    electionId: credential.electionId,
    votingCredentialId: credential.id,
    eventType: CredentialEventType.IDENTIFIER_CHECK_FAILED,
    method,
    success: false,
    failureReasonCode,
    occurredAt
  });
}

export function buildCredentialLockedEvent({
  credential,
  method,
  occurredAt = new Date()
}: {
  credential: VotingCredentialAuthRecord;
  method: AuthenticationMethodValue;
  occurredAt?: Date;
}): CredentialEventInput {
  return buildCredentialEvent({
    electionId: credential.electionId,
    votingCredentialId: credential.id,
    eventType: CredentialEventType.LOCKED,
    method,
    success: false,
    failureReasonCode: "credential_locked",
    occurredAt
  });
}

export async function verifyVoterIdentifier({
  voterSession,
  identifier,
  hmacKey,
  repository,
  now = new Date()
}: {
  voterSession: { votingCredentialId: string; authenticationMethod: AuthenticationMethodValue };
  identifier: string;
  hmacKey: string;
  repository: VoterAuthRepository;
  now?: Date;
}): Promise<VerifyIdentifierResult> {
  const credential = await repository.findVotingCredential(voterSession.votingCredentialId);
  if (!credential || isCredentialLocked(credential, now)) {
    throw genericAuthError("credential missing or locked");
  }

  const providedHmac = hashVoterIdentifier(identifier, hmacKey);
  const matched = safeEqualHex(providedHmac, credential.externalIdentifierHmac);

  if (!matched) {
    const failedAttempts = credential.identifierFailedAttempts + 1;
    const locked = failedAttempts >= IDENTIFIER_LOCK_POLICY.maxFailedAttempts;
    const lockUntil = locked
      ? new Date(now.getTime() + IDENTIFIER_LOCK_POLICY.lockMinutes * 60_000)
      : null;
    const update = {
      votingCredentialId: credential.id,
      authStatus: "failed" as const,
      credentialStatus: locked ? ("locked" as const) : credential.credentialStatus,
      identifierFailedAttempts: failedAttempts,
      lockedUntil: lockUntil
    };
    const event = buildIdentifierVerificationFailureEvent({
      credential,
      method: voterSession.authenticationMethod,
      failureReasonCode: locked ? "credential_locked" : "identifier_mismatch",
      occurredAt: now
    });
    await repository.updateVotingCredential(update);
    await repository.recordCredentialEvent(event);
    if (locked) {
      await repository.recordCredentialEvent(
        buildCredentialLockedEvent({
          credential,
          method: voterSession.authenticationMethod,
          occurredAt: now
        })
      );
    }
    throw genericAuthError("identifier verification failed");
  }

  const update = {
    votingCredentialId: credential.id,
    authStatus: requiresOneTimeCode(voterSession.authenticationMethod)
      ? ("code_pending" as const)
      : ("authenticated" as const),
    credentialStatus: "active" as const,
    identifierFailedAttempts: 0,
    lockedUntil: null,
    authenticatedAt: requiresOneTimeCode(voterSession.authenticationMethod) ? undefined : now
  };
  const event = buildIdentifierVerificationSuccessEvent({
    credential,
    method: voterSession.authenticationMethod,
    occurredAt: now
  });

  await repository.updateVotingCredential(update);
  await repository.recordCredentialEvent(event);

  return Object.freeze({
    credentialUpdate: Object.freeze(update),
    event,
    authenticated: update.authStatus === "authenticated"
  });
}

export function canRequestOneTimeCode(method: AuthenticationMethodValue): boolean {
  return requiresOneTimeCode(method);
}

export async function requestOneTimeCode(method: AuthenticationMethodValue): Promise<never> {
  if (!canRequestOneTimeCode(method)) {
    throw createForbiddenError(`one-time code is not enabled for ${method}`);
  }
  throw createForbiddenError("one-time code provider is disabled in MVP");
}

export async function verifyOneTimeCode(method: AuthenticationMethodValue): Promise<never> {
  if (!requiresOneTimeCode(method)) {
    throw createForbiddenError(`one-time code is not enabled for ${method}`);
  }
  throw createForbiddenError("one-time code verification provider is disabled in MVP");
}

export const disabledPaidAuthenticationProviders = Object.freeze({
  [AuthenticationMethod.SMS_CODE]: "disabled_paid_provider",
  [AuthenticationMethod.KAKAO_MESSAGE]: "disabled_paid_provider",
  [AuthenticationMethod.EXTERNAL_IDENTITY]: "disabled_paid_provider",
  [AuthenticationMethod.SSO]: "disabled_paid_provider",
  [AuthenticationMethod.LEGAL_STRONG_AUTH]: "disabled_paid_provider"
});
