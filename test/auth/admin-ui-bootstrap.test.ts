import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Role } from "../../src/guardrails/index.js";
import { AdminLoginForm } from "../../src/components/admin/admin-login-form";
import { StepUpPanel } from "../../src/components/admin/step-up-panel";
import { bootstrapInitialAdmin } from "../../src/server/auth/bootstrap-admin";
import { verifyAdminPassword } from "../../src/server/auth/password";

const projectRoot = process.cwd();
const hmacKey = "admin-bootstrap-test-hmac-key-with-32-chars";

function source(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

function createBootstrapPrismaDouble() {
  const state = {
    users: [] as Array<{
      id: string;
      tenantId: string;
      organizationId: string;
      emailHash: string;
      passwordHash: string;
      status: string;
      mfaRequired: boolean;
    }>,
    tenants: [] as Array<{ id: string; name: string }>,
    organizations: [] as Array<{ id: string; tenantId: string; name: string }>,
    userRoles: [] as Array<{ userId: string; roleId: string }>,
    roles: [
      { id: "role-organization-owner", code: Role.ORGANIZATION_OWNER, organizationId: null }
    ]
  };
  const prisma = {
    user: {
      findFirst: async () => (state.userRoles.length > 0 ? state.users[0] : null),
      create: async ({ data }: { data: any }) => {
        const record = { id: `user-${state.users.length + 1}`, ...data };
        state.users.push(record);
        return record;
      }
    },
    role: {
      findFirst: async ({ where }: { where: { code: string; organizationId: null } }) =>
        state.roles.find((role) => role.code === where.code && role.organizationId === where.organizationId) ?? null
    },
    tenant: {
      create: async ({ data }: { data: { name: string } }) => {
        const record = { id: `tenant-${state.tenants.length + 1}`, ...data };
        state.tenants.push(record);
        return record;
      }
    },
    organization: {
      create: async ({ data }: { data: { tenantId: string; name: string } }) => {
        const record = { id: `org-${state.organizations.length + 1}`, ...data };
        state.organizations.push(record);
        return record;
      }
    },
    userRole: {
      create: async ({ data }: { data: { userId: string; roleId: string } }) => {
        state.userRoles.push(data);
        return data;
      }
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(prisma)
  };
  return { prisma, state };
}

describe("admin UI auth guardrails", () => {
  it("login form renders username/password inputs and generic failure copy", () => {
    const markup = renderToStaticMarkup(createElement(AdminLoginForm));

    expect(markup).toContain('type="text"');
    expect(markup).toContain('type="password"');
    expect(source("src/components/admin/admin-login-form.tsx")).toContain("인증 정보를 확인할 수 없습니다.");
    expect(markup).not.toMatch(/sessionToken|stepUpToken|tokenHash|passwordHash/);
  });

  it("step-up panel has an API boundary and does not render token material", () => {
    const markup = renderToStaticMarkup(
      createElement(StepUpPanel, {
        permissionCodes: ["result.publish"],
        purpose: "publish result"
      })
    );
    const componentSource = source("src/components/admin/step-up-panel.tsx");

    expect(componentSource).toContain("/api/v1/admin/auth/step-up");
    expect(markup).toContain("위험 작업 추가 인증");
    expect(markup).not.toMatch(/stepUpToken|tokenHash|sessionToken/);
  });

  it("protected admin layout restores session and redirects unauthenticated users", () => {
    const layoutSource = source("src/app/admin/(protected)/layout.tsx");

    expect(layoutSource).toContain("getCurrentAdminSessionFromCookies");
    expect(layoutSource).toContain('redirect("/admin/login")');
    expect(source("src/components/admin/admin-logout-button.tsx")).toContain("/api/v1/admin/auth/logout");
  });
});

describe("initial admin bootstrap policy", () => {
  it("stores only a password hash and refuses to create a second admin", async () => {
    const { prisma, state } = createBootstrapPrismaDouble();
    const password = "one-time-bootstrap-password";

    const first = await bootstrapInitialAdmin(prisma as any, {
      username: "owner-admin",
      password,
      hmacKey,
      tenantName: "Bootstrap Tenant",
      organizationName: "Bootstrap Organization"
    });
    const second = await bootstrapInitialAdmin(prisma as any, {
      username: "owner-admin-2",
      password: "another-one-time-password",
      hmacKey
    });

    expect(first.created).toBe(true);
    expect(second).toMatchObject({ created: false, reason: "admin_already_exists" });
    expect(state.users).toHaveLength(1);
    expect(state.userRoles.map((entry) => entry.roleId)).toEqual(["role-organization-owner"]);
    expect(state.users[0].passwordHash).not.toBe(password);
    expect(await verifyAdminPassword(password, state.users[0].passwordHash)).toBe(true);
  });

  it("requires explicit confirmation in production", async () => {
    const { prisma } = createBootstrapPrismaDouble();

    await expect(
      bootstrapInitialAdmin(prisma as any, {
        username: "owner-admin",
        password: "one-time-bootstrap-password",
        hmacKey,
        nodeEnv: "production"
      })
    ).rejects.toThrow(/BOOTSTRAP_CONFIRM/);
  });
});
