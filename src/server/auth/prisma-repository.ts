import {
  PermissionRiskLevel,
  Prisma,
  RecordStatus,
  SecurityEventType as PrismaSecurityEventType,
  UserStatus
} from "@prisma/client";

import type { SecurityEventInput } from "../audit/security-event";
import type { PrismaClientLike } from "../db/prisma";
import { redactSensitiveValues } from "../privacy/redaction";
import type {
  AdminAuthRepository,
  AdminSessionCreateCommand,
  AdminSessionRecord,
  AdminStepUpGrantCreateCommand,
  AdminStepUpGrantRecord,
  AdminUserAuthRecord
} from "./repository";

function mapUser(record: {
  id: string;
  tenantId: string;
  organizationId: string | null;
  emailHash: string;
  passwordHash: string;
  status: string;
  mfaRequired: boolean;
  userRoles: {
    role: {
      code: string;
      permissions: { permission: { code: string } }[];
    };
  }[];
}): AdminUserAuthRecord {
  return Object.freeze({
    id: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    emailHash: record.emailHash,
    passwordHash: record.passwordHash,
    status: record.status as AdminUserAuthRecord["status"],
    mfaRequired: record.mfaRequired,
    roles: Array.from(new Set(record.userRoles.map((entry) => entry.role.code))).sort(),
    permissions: Array.from(
      new Set(
        record.userRoles.flatMap((entry) =>
          entry.role.permissions.map((rolePermission) => rolePermission.permission.code)
        )
      )
    ).sort()
  });
}

function mapSession(record: {
  id: string;
  userId: string;
  sessionTokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}): AdminSessionRecord {
  return Object.freeze({
    id: record.id,
    userId: record.userId,
    sessionTokenHash: record.sessionTokenHash,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    lastUsedAt: record.lastUsedAt
  });
}

function permissionCodesFromJson(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function mapGrant(record: {
  id: string;
  adminSessionId: string;
  userId: string;
  tokenHash: string;
  permissionCodes: Prisma.JsonValue;
  purpose: string | null;
  verifiedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}): AdminStepUpGrantRecord {
  return Object.freeze({
    id: record.id,
    adminSessionId: record.adminSessionId,
    userId: record.userId,
    tokenHash: record.tokenHash,
    permissionCodes: permissionCodesFromJson(record.permissionCodes),
    purpose: record.purpose,
    verifiedAt: record.verifiedAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt
  });
}

function userInclude() {
  return {
    userRoles: {
      where: {
        role: { status: RecordStatus.active }
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    }
  } satisfies Prisma.UserInclude;
}

export class PrismaAdminAuthRepository implements AdminAuthRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findUserByUsernameHash(usernameHash: string): Promise<AdminUserAuthRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { emailHash: usernameHash },
      include: userInclude()
    });
    return user ? mapUser(user) : null;
  }

  async findUserById(userId: string): Promise<AdminUserAuthRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userInclude()
    });
    return user ? mapUser(user) : null;
  }

  async createAdminSession(command: AdminSessionCreateCommand): Promise<AdminSessionRecord> {
    const session = await this.prisma.adminSession.create({
      data: {
        userId: command.userId,
        sessionTokenHash: command.sessionTokenHash,
        issuedAt: command.issuedAt,
        expiresAt: command.expiresAt
      }
    });
    return mapSession(session);
  }

  async findAdminSessionByTokenHash(
    tokenHash: string,
    now = new Date()
  ): Promise<AdminSessionRecord | null> {
    const session = await this.prisma.adminSession.findUnique({
      where: { sessionTokenHash: tokenHash }
    });
    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }
    return mapSession(session);
  }

  async touchAdminSession(sessionTokenHash: string, touchedAt = new Date()): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: {
        sessionTokenHash,
        revokedAt: null,
        expiresAt: { gt: touchedAt }
      },
      data: { lastUsedAt: touchedAt }
    });
  }

  async revokeAdminSession(sessionTokenHash: string, revokedAt = new Date()): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { sessionTokenHash, revokedAt: null },
      data: { revokedAt }
    });
    await this.prisma.adminStepUpGrant.updateMany({
      where: {
        adminSession: { sessionTokenHash },
        revokedAt: null
      },
      data: { revokedAt }
    });
  }

  async createStepUpGrant(command: AdminStepUpGrantCreateCommand): Promise<AdminStepUpGrantRecord> {
    const grant = await this.prisma.adminStepUpGrant.create({
      data: {
        adminSessionId: command.adminSessionId,
        userId: command.userId,
        tokenHash: command.tokenHash,
        permissionCodes: [...command.permissionCodes] as Prisma.InputJsonValue,
        purpose: command.purpose,
        verifiedAt: command.verifiedAt,
        expiresAt: command.expiresAt
      }
    });
    return mapGrant(grant);
  }

  async findActiveStepUpGrantsForSession(
    adminSessionId: string,
    now = new Date()
  ): Promise<AdminStepUpGrantRecord[]> {
    const grants = await this.prisma.adminStepUpGrant.findMany({
      where: {
        adminSessionId,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      orderBy: { expiresAt: "desc" }
    });
    return grants.map(mapGrant);
  }

  async findStepUpGrantByTokenHash(
    tokenHash: string,
    now = new Date()
  ): Promise<AdminStepUpGrantRecord | null> {
    const grant = await this.prisma.adminStepUpGrant.findUnique({ where: { tokenHash } });
    if (!grant || grant.revokedAt || grant.expiresAt <= now) {
      return null;
    }
    return mapGrant(grant);
  }

  async revokeStepUpGrant(tokenHash: string, revokedAt = new Date()): Promise<void> {
    await this.prisma.adminStepUpGrant.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt }
    });
  }

  async recordSecurityEvent(event: SecurityEventInput): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        tenantId: event.tenantId,
        actorType: event.actorType,
        actorId: event.actorId,
        eventType: event.eventType as PrismaSecurityEventType,
        riskLevel: event.riskLevel as PermissionRiskLevel,
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
}

export function createPrismaAdminAuthRepository(prisma: PrismaClientLike): AdminAuthRepository {
  return new PrismaAdminAuthRepository(prisma);
}
