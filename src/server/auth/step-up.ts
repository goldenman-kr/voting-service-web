import { ControlRequirement, PERMISSION_BY_CODE, RiskLevel } from "../../guardrails/index.js";
import type { AdminSession } from "./admin-session";
import { createStepUpRequiredError } from "../http/errors";

export type StepUpState = NonNullable<AdminSession["stepUp"]>;

export function isStepUpValid(
  stepUp: StepUpState | undefined,
  now: Date = new Date(),
  permissionCode?: string
): boolean {
  if (!stepUp || stepUp.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return !permissionCode || !stepUp.permissionCodes || stepUp.permissionCodes.includes(permissionCode);
}

export function isStepUpRequiredForPermission(permissionCode: string): boolean {
  const permission = PERMISSION_BY_CODE[permissionCode];
  if (!permission) {
    return false;
  }
  return (
    permission.stepUp === ControlRequirement.YES ||
    permission.stepUp === ControlRequirement.CONDITIONAL ||
    permission.risk === RiskLevel.HIGH ||
    permission.risk === RiskLevel.CRITICAL
  );
}

export function assertStepUpSatisfied(
  session: AdminSession,
  permissionCode: string,
  now: Date = new Date()
): void {
  if (isStepUpRequiredForPermission(permissionCode) && !isStepUpValid(session.stepUp, now, permissionCode)) {
    throw createStepUpRequiredError(`step-up required for ${permissionCode}`);
  }
}
