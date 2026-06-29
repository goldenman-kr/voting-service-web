import { describe, expect, it } from "vitest";

import { Role } from "../../src/guardrails/index.js";
import { createMockAdminSession } from "../../src/server/auth/admin-session";
import { isStepUpRequiredForPermission, isStepUpValid } from "../../src/server/auth/step-up";
import {
  getPermissionRiskLevel,
  hasPermission,
  isHighOrCriticalPermission,
  requireAllPermissions,
  requireAnyPermission,
  requirePermission,
  requirePermissionWithStepUp
} from "../../src/server/rbac/authorize";

describe("RBAC authorization helpers", () => {
  it("checks permissions from role mapping", () => {
    const manager = createMockAdminSession({ roles: [Role.ELECTION_MANAGER] });

    expect(hasPermission(manager, "election.create")).toBe(true);
    expect(hasPermission(manager, "result.publish")).toBe(false);
    expect(() => requirePermission(manager, "election.create")).not.toThrow();
    expect(() => requirePermission(manager, "result.publish")).toThrow(/권한/);
  });

  it("supports any/all permission checks", () => {
    const owner = createMockAdminSession({ roles: [Role.ORGANIZATION_OWNER] });

    expect(() =>
      requireAnyPermission(owner, ["result.publish", "organization.update"])
    ).not.toThrow();
    expect(() =>
      requireAllPermissions(owner, ["organization.read", "organization.update"])
    ).not.toThrow();
    expect(() =>
      requireAllPermissions(owner, ["organization.read", "result.publish"])
    ).toThrow(/권한/);
  });

  it("identifies high and critical permission controls", () => {
    expect(getPermissionRiskLevel("role.assign")).toBe("critical");
    expect(isHighOrCriticalPermission("role.assign")).toBe(true);
    expect(isStepUpRequiredForPermission("role.assign")).toBe(true);
    expect(isStepUpRequiredForPermission("election.read")).toBe(false);
  });

  it("requires valid step-up for high-risk permissions", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const publisher = createMockAdminSession({
      roles: [Role.RESULT_PUBLISHER],
      stepUp: {
        verifiedAt: now,
        expiresAt: new Date("2026-01-01T00:05:00.000Z"),
        permissionCodes: ["result.publish"]
      }
    });

    expect(isStepUpValid(publisher.stepUp, now, "result.publish")).toBe(true);
    expect(() => requirePermissionWithStepUp(publisher, "result.publish", now)).not.toThrow();

    const withoutStepUp = createMockAdminSession({ roles: [Role.RESULT_PUBLISHER] });
    expect(() => requirePermissionWithStepUp(withoutStepUp, "result.publish", now)).toThrow(
      /추가 인증/
    );
  });
});
