import type { AdminSession } from "./admin-session";
import type { SecurityEventInput } from "../audit/security-event";

export type AdminUserStatusValue = "active" | "disabled" | "locked" | "invited";

export type AdminUserAuthRecord = Readonly<{
  id: string;
  tenantId: string;
  organizationId?: string | null;
  emailHash: string;
  passwordHash: string;
  status: AdminUserStatusValue;
  mfaRequired: boolean;
  roles: readonly string[];
  permissions: readonly string[];
}>;

export type AdminSessionRecord = Readonly<{
  id: string;
  userId: string;
  sessionTokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
}>;

export type AdminStepUpGrantRecord = Readonly<{
  id: string;
  adminSessionId: string;
  userId: string;
  tokenHash: string;
  permissionCodes: readonly string[];
  purpose?: string | null;
  verifiedAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
}>;

export type AdminSessionCreateCommand = Readonly<{
  userId: string;
  sessionTokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
}>;

export type AdminStepUpGrantCreateCommand = Readonly<{
  adminSessionId: string;
  userId: string;
  tokenHash: string;
  permissionCodes: readonly string[];
  purpose?: string;
  verifiedAt: Date;
  expiresAt: Date;
}>;

export type AdminAuthRepository = {
  findUserByEmailHash(emailHash: string): Promise<AdminUserAuthRecord | null>;
  findUserById(userId: string): Promise<AdminUserAuthRecord | null>;
  createAdminSession(command: AdminSessionCreateCommand): Promise<AdminSessionRecord>;
  findAdminSessionByTokenHash(
    tokenHash: string,
    now?: Date
  ): Promise<AdminSessionRecord | null>;
  touchAdminSession(sessionTokenHash: string, touchedAt?: Date): Promise<void>;
  revokeAdminSession(sessionTokenHash: string, revokedAt?: Date): Promise<void>;
  createStepUpGrant(command: AdminStepUpGrantCreateCommand): Promise<AdminStepUpGrantRecord>;
  findActiveStepUpGrantsForSession(
    adminSessionId: string,
    now?: Date
  ): Promise<AdminStepUpGrantRecord[]>;
  findStepUpGrantByTokenHash(
    tokenHash: string,
    now?: Date
  ): Promise<AdminStepUpGrantRecord | null>;
  revokeStepUpGrant(tokenHash: string, revokedAt?: Date): Promise<void>;
  recordSecurityEvent(event: SecurityEventInput): Promise<void>;
};

export type RestoredAdminSession = Readonly<{
  session: AdminSession;
  sessionRecord: AdminSessionRecord;
}>;
