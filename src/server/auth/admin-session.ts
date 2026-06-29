import { PERMISSION_CODES, ROLE_PERMISSIONS, Role } from "../../guardrails/index.js";

export type AdminSession = Readonly<{
  sessionId: string;
  actor: "admin";
  userId: string;
  tenantId: string;
  organizationId?: string;
  roles: readonly string[];
  permissions: readonly string[];
  issuedAt: Date;
  expiresAt: Date;
  stepUp?: {
    verifiedAt: Date;
    expiresAt: Date;
    purpose?: string;
    permissionCodes?: readonly string[];
  };
}>;

export const ADMIN_SESSION_COOKIE_POLICY = Object.freeze({
  name: "admin_session",
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  tokenLogging: "forbidden"
});

export const ADMIN_STEP_UP_COOKIE_POLICY = Object.freeze({
  name: "admin_step_up",
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  tokenLogging: "forbidden"
});

const rolePermissionsByCode = ROLE_PERMISSIONS as Readonly<Record<string, readonly string[]>>;

export function collectPermissionsForRoles(roles: readonly string[]): string[] {
  return Array.from(
    new Set(
      roles.flatMap((role) =>
        role in rolePermissionsByCode ? Array.from(rolePermissionsByCode[role]) : []
      )
    )
  ).sort();
}

export function createMockAdminSession({
  sessionId = "mock-admin-session",
  userId = "00000000-0000-0000-0000-000000000001",
  tenantId = "00000000-0000-0000-0000-000000000010",
  organizationId = "00000000-0000-0000-0000-000000000020",
  roles = [Role.ELECTION_MANAGER],
  permissions,
  issuedAt = new Date("2026-01-01T00:00:00.000Z"),
  expiresAt = new Date("2026-01-01T01:00:00.000Z"),
  stepUp
}: Partial<AdminSession> = {}): AdminSession {
  return Object.freeze({
    sessionId,
    actor: "admin",
    userId,
    tenantId,
    organizationId,
    roles,
    permissions: permissions ?? collectPermissionsForRoles(roles),
    issuedAt,
    expiresAt,
    stepUp
  });
}

export function createLocalDevelopmentAdminSession(now = new Date()): AdminSession | undefined {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
  return createMockAdminSession({
    sessionId: "local-development-admin-session",
    roles: [Role.ORGANIZATION_OWNER],
    permissions: PERMISSION_CODES,
    issuedAt: now,
    expiresAt,
    stepUp: {
      verifiedAt: now,
      expiresAt,
      purpose: "local development route skeleton",
      permissionCodes: PERMISSION_CODES
    }
  });
}
