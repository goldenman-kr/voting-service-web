import {
  AuthStatus,
  AuthenticationMethod as PrismaAuthenticationMethod,
  CredentialEventType as PrismaCredentialEventType,
  CredentialStatus,
  InvitationStatus,
  NotificationChannel,
  PermissionRiskLevel,
  Prisma,
  SecurityEventType as PrismaSecurityEventType
} from "@prisma/client";

import { getDefaultAuthenticationMethod } from "../../domain/auth-policy/authentication-policy";
import type { AuthenticationMethodValue } from "../../domain/auth-policy/authentication-policy";
import { redactSensitiveValues } from "../privacy/redaction";
import type { PrismaClientLike } from "../db/prisma";
import type {
  AuthenticationPolicyRecord,
  CredentialEventInput,
  CredentialUpdateCommand,
  InvitationAuthRecord,
  VoterAuthRepository,
  VoterSessionAuthenticationCommand,
  VoterSessionCreateCommand,
  VoterSessionRecord,
  VotingCredentialAuthRecord
} from "./repository";
import type { SecurityEventInput } from "../audit/security-event";

function toAuthenticationMethod(method: string) {
  return method as PrismaAuthenticationMethod;
}

function toAuthStatus(status: string) {
  return status as AuthStatus;
}

function toCredentialStatus(status: string) {
  return status as CredentialStatus;
}

function toCredentialEventType(eventType: string) {
  return eventType as PrismaCredentialEventType;
}

function toNotificationChannel(channel?: string) {
  return channel ? (channel as NotificationChannel) : undefined;
}

function toSecurityEventType(eventType: string) {
  return eventType as PrismaSecurityEventType;
}

function toPermissionRiskLevel(riskLevel: string) {
  return riskLevel as PermissionRiskLevel;
}

function mapVoterSessionRecord(record: {
  id: string;
  opaqueHandleHash: string;
  electionId: string;
  eligibleVoterId: string;
  votingCredentialId: string;
  authenticationMethod: string;
  authenticated: boolean;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}): VoterSessionRecord {
  return Object.freeze({
    sessionId: record.id,
    opaqueHandleHash: record.opaqueHandleHash,
    electionId: record.electionId,
    eligibleVoterId: record.eligibleVoterId,
    votingCredentialId: record.votingCredentialId,
    authenticationMethod: record.authenticationMethod as AuthenticationMethodValue,
    authenticated: record.authenticated,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    lastUsedAt: record.lastUsedAt
  });
}

export class PrismaVoterAuthRepository implements VoterAuthRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findInvitationByTokenHash(tokenHash: string): Promise<InvitationAuthRecord | null> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { inviteTokenHash: tokenHash },
      select: {
        id: true,
        electionId: true,
        eligibleVoterId: true,
        inviteTokenHash: true,
        status: true,
        expiresAt: true
      }
    });

    if (!invitation) {
      return null;
    }

    const [authenticationPolicy, votingCredential] = await Promise.all([
      this.findAuthenticationPolicy(invitation.electionId),
      this.prisma.votingCredential.findUnique({
        where: {
          electionId_eligibleVoterId: {
            electionId: invitation.electionId,
            eligibleVoterId: invitation.eligibleVoterId
          }
        },
        select: { id: true }
      })
    ]);

    if (!votingCredential) {
      return null;
    }

    return Object.freeze({
      id: invitation.id,
      electionId: invitation.electionId,
      eligibleVoterId: invitation.eligibleVoterId,
      votingCredentialId: votingCredential.id,
      inviteTokenHash: invitation.inviteTokenHash,
      status: invitation.status as InvitationStatus,
      expiresAt: invitation.expiresAt,
      authenticationMethod: authenticationPolicy?.method ?? getDefaultAuthenticationMethod()
    });
  }

  async findAuthenticationPolicy(electionId: string): Promise<AuthenticationPolicyRecord | null> {
    const policy = await this.prisma.authenticationPolicy.findUnique({
      where: { electionId },
      select: {
        electionId: true,
        method: true,
        isEnabled: true,
        isPaidMethod: true,
        provider: true
      }
    });

    return policy
      ? Object.freeze({
          electionId: policy.electionId,
          method: policy.method,
          isEnabled: policy.isEnabled,
          isPaidMethod: policy.isPaidMethod,
          provider: policy.provider
        })
      : null;
  }

  async findVotingCredential(id: string): Promise<VotingCredentialAuthRecord | null> {
    const credential = await this.prisma.votingCredential.findUnique({
      where: { id },
      select: {
        id: true,
        electionId: true,
        eligibleVoterId: true,
        credentialStatus: true,
        authStatus: true,
        identifierFailedAttempts: true,
        lockedUntil: true,
        hasVoted: true,
        eligibleVoter: {
          select: {
            externalIdentifierHmac: true,
            searchHmac: true,
            registry: {
              select: { useBirthDateForVerification: true }
            }
          }
        }
      }
    });

    return credential
      ? Object.freeze({
          id: credential.id,
          electionId: credential.electionId,
          eligibleVoterId: credential.eligibleVoterId,
          credentialStatus: credential.credentialStatus,
          authStatus: credential.authStatus,
          identifierFailedAttempts: credential.identifierFailedAttempts,
          lockedUntil: credential.lockedUntil,
          externalIdentifierHmac:
            credential.eligibleVoter.registry.useBirthDateForVerification
              ? credential.eligibleVoter.externalIdentifierHmac
              : credential.eligibleVoter.searchHmac ?? credential.eligibleVoter.externalIdentifierHmac,
          hasVoted: credential.hasVoted
        })
      : null;
  }

  async updateVotingCredential(command: CredentialUpdateCommand): Promise<void> {
    await this.prisma.votingCredential.update({
      where: { id: command.votingCredentialId },
      data: {
        ...(command.authStatus ? { authStatus: toAuthStatus(command.authStatus) } : {}),
        ...(command.credentialStatus
          ? { credentialStatus: toCredentialStatus(command.credentialStatus) }
          : {}),
        ...(command.identifierFailedAttempts !== undefined
          ? { identifierFailedAttempts: command.identifierFailedAttempts }
          : {}),
        ...(command.lockedUntil !== undefined ? { lockedUntil: command.lockedUntil } : {}),
        ...(command.authenticatedAt !== undefined ? { authenticatedAt: command.authenticatedAt } : {})
      }
    });
  }

  async recordCredentialEvent(event: CredentialEventInput): Promise<void> {
    await this.prisma.credentialEvent.create({
      data: {
        electionId: event.electionId,
        votingCredentialId: event.votingCredentialId,
        eventType: toCredentialEventType(event.eventType),
        method: toAuthenticationMethod(event.method),
        channel: toNotificationChannel(event.channel),
        provider: event.provider,
        success: event.success,
        failureReasonCode: event.failureReasonCode,
        occurredAt: event.occurredAt,
        metadata: event.metadata
          ? (redactSensitiveValues(event.metadata) as Prisma.InputJsonValue)
          : undefined
      }
    });
  }

  async recordSecurityEvent(event: SecurityEventInput): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        tenantId: event.tenantId,
        actorType: event.actorType,
        actorId: event.actorId,
        eventType: toSecurityEventType(event.eventType),
        riskLevel: toPermissionRiskLevel(event.riskLevel),
        ipMasked: event.ipMasked,
        ipHash: event.ipHash,
        userAgentSummary: event.userAgentSummary,
        occurredAt: event.occurredAt,
        metadata: event.metadata
          ? (redactSensitiveValues(event.metadata) as Prisma.InputJsonValue)
          : undefined
      }
    });
  }

  async createVoterSessionRecord(session: VoterSessionCreateCommand): Promise<void> {
    await this.prisma.voterSession.create({
      data: {
        electionId: session.electionId,
        eligibleVoterId: session.eligibleVoterId,
        votingCredentialId: session.votingCredentialId,
        opaqueHandleHash: session.opaqueHandleHash,
        authenticationMethod: toAuthenticationMethod(session.authenticationMethod),
        authenticated: session.authenticated,
        step: session.authenticated ? AuthStatus.authenticated : AuthStatus.not_started,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt
      }
    });
  }

  async storeVoterSession(session: VoterSessionCreateCommand): Promise<void> {
    await this.createVoterSessionRecord(session);
  }

  async findVoterSessionByHandleHash(
    handleHash: string,
    now = new Date()
  ): Promise<VoterSessionRecord | null> {
    const session = await this.prisma.voterSession.findUnique({
      where: { opaqueHandleHash: handleHash },
      select: {
        id: true,
        opaqueHandleHash: true,
        electionId: true,
        eligibleVoterId: true,
        votingCredentialId: true,
        authenticationMethod: true,
        authenticated: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }

    return mapVoterSessionRecord(session);
  }

  async updateVoterSessionAuthentication(
    command: VoterSessionAuthenticationCommand
  ): Promise<void> {
    await this.prisma.voterSession.updateMany({
      where: {
        opaqueHandleHash: command.handleHash,
        revokedAt: null
      },
      data: {
        authenticated: command.authenticated,
        identifierVerifiedAt: command.identifierVerifiedAt,
        step: toAuthStatus(command.step)
      }
    });
  }

  async revokeVoterSession(handleHash: string, revokedAt = new Date()): Promise<void> {
    await this.prisma.voterSession.updateMany({
      where: {
        opaqueHandleHash: handleHash,
        revokedAt: null
      },
      data: { revokedAt }
    });
  }

  async touchVoterSession(handleHash: string, touchedAt = new Date()): Promise<void> {
    await this.prisma.voterSession.updateMany({
      where: {
        opaqueHandleHash: handleHash,
        revokedAt: null,
        expiresAt: { gt: touchedAt }
      },
      data: { lastUsedAt: touchedAt }
    });
  }
}

export function createPrismaVoterAuthRepository(prisma: PrismaClientLike): VoterAuthRepository {
  return new PrismaVoterAuthRepository(prisma);
}
