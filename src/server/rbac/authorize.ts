import { PERMISSION_BY_CODE, RiskLevel } from "../../guardrails/index.js";
import type { AdminSession } from "../auth/admin-session";
import { assertStepUpSatisfied, isStepUpRequiredForPermission } from "../auth/step-up";
import { createForbiddenError } from "../http/errors";

export type PermissionCode = string;

export function hasPermission(session: AdminSession | undefined, permission: PermissionCode): boolean {
  return Boolean(session?.permissions.includes(permission));
}

export function requirePermission(
  session: AdminSession | undefined,
  permission: PermissionCode
): AdminSession {
  if (!session || !hasPermission(session, permission)) {
    throw createForbiddenError(`missing permission ${permission}`);
  }
  return session;
}

export function requireAnyPermission(
  session: AdminSession | undefined,
  permissions: readonly PermissionCode[]
): AdminSession {
  if (!session || !permissions.some((permission) => hasPermission(session, permission))) {
    throw createForbiddenError(`missing any permission ${permissions.join(",")}`);
  }
  return session;
}

export function requireAllPermissions(
  session: AdminSession | undefined,
  permissions: readonly PermissionCode[]
): AdminSession {
  if (!session) {
    throw createForbiddenError(`missing all permissions ${permissions.join(",")}`);
  }
  for (const permission of permissions) {
    requirePermission(session, permission);
  }
  return session;
}

export function getPermissionRiskLevel(permission: PermissionCode): string | undefined {
  return PERMISSION_BY_CODE[permission]?.risk;
}

export function isHighOrCriticalPermission(permission: PermissionCode): boolean {
  const risk = getPermissionRiskLevel(permission);
  return risk === RiskLevel.HIGH || risk === RiskLevel.CRITICAL;
}

export function requirePermissionWithStepUp(
  session: AdminSession | undefined,
  permission: PermissionCode,
  now: Date = new Date()
): AdminSession {
  const authorizedSession = requirePermission(session, permission);
  assertStepUpSatisfied(authorizedSession, permission, now);
  return authorizedSession;
}

export { isStepUpRequiredForPermission };
