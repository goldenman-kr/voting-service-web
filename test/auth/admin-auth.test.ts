import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { Role } from "../../src/guardrails/index.js";
import {
  ADMIN_SESSION_COOKIE_POLICY,
  createLocalDevelopmentAdminSession,
  createMockAdminSession
} from "../../src/server/auth/admin-session";
import {
  assertAdminAuthResultContainsNoSecrets,
  createPasswordStepUpGrant,
  hashAdminEmail,
  hashAdminOpaqueToken,
  loginAdmin,
  logoutAdmin,
  restoreAdminSession
} from "../../src/server/auth/admin-auth-service";
import { hashAdminPassword } from "../../src/server/auth/password";
import type {
  AdminAuthRepository,
  AdminSessionCreateCommand,
  AdminSessionRecord,
  AdminStepUpGrantCreateCommand,
  AdminStepUpGrantRecord,
  AdminUserAuthRecord
} from "../../src/server/auth/repository";
import {
  createProductionAdminAuthDependencies,
  handleAdminLoginRoute,
  handleAdminMeRoute,
  handleAdminStepUpRoute
} from "../../src/server/auth/route-handlers";
import { requirePermissionWithStepUp } from "../../src/server/rbac/authorize";
import { handleListElectionsRoute } from "../../src/server/elections/route-handlers";
import type { ElectionRepository } from "../../src/server/elections/repository";

const hmacKey = "admin-auth-test-hmac-key-with-32-chars";
const now = new Date("2026-01-01T00:00:00.000Z");

class InMemoryAdminAuthRepository implements AdminAuthRepository {
  users = new Map<string, AdminUserAuthRecord>();
  sessions = new Map<string, AdminSessionRecord>();
  grants = new Map<string, AdminStepUpGrantRecord>();
  events: unknown[] = [];
  seq = 1;

  id(prefix: string) {
    return `${prefix}-${this.seq++}`;
  }

  addUser(user: AdminUserAuthRecord) {
    this.users.set(user.id, user);
  }

  async findUserByEmailHash(emailHash: string) {
    return [...this.users.values()].find((user) => user.emailHash === emailHash) ?? null;
  }

  async findUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async createAdminSession(command: AdminSessionCreateCommand) {
    const session = {
      id: this.id("admin-session"),
      userId: command.userId,
      sessionTokenHash: command.sessionTokenHash,
      issuedAt: command.issuedAt,
      expiresAt: command.expiresAt,
      revokedAt: null,
      lastUsedAt: null
    };
    this.sessions.set(command.sessionTokenHash, session);
    return session;
  }

  async findAdminSessionByTokenHash(tokenHash: string, at = now) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revokedAt || session.expiresAt <= at) return null;
    return session;
  }

  async touchAdminSession(sessionTokenHash: string, touchedAt = now) {
    const session = this.sessions.get(sessionTokenHash);
    if (session) this.sessions.set(sessionTokenHash, { ...session, lastUsedAt: touchedAt });
  }

  async revokeAdminSession(sessionTokenHash: string, revokedAt = now) {
    const session = this.sessions.get(sessionTokenHash);
    if (session) this.sessions.set(sessionTokenHash, { ...session, revokedAt });
  }

  async createStepUpGrant(command: AdminStepUpGrantCreateCommand) {
    const grant = {
      id: this.id("step-up"),
      adminSessionId: command.adminSessionId,
      userId: command.userId,
      tokenHash: command.tokenHash,
      permissionCodes: command.permissionCodes,
      purpose: command.purpose,
      verifiedAt: command.verifiedAt,
      expiresAt: command.expiresAt,
      revokedAt: null
    };
    this.grants.set(command.tokenHash, grant);
    return grant;
  }

  async findActiveStepUpGrantsForSession(adminSessionId: string, at = now) {
    return [...this.grants.values()].filter(
      (grant) => grant.adminSessionId === adminSessionId && !grant.revokedAt && grant.expiresAt > at
    );
  }

  async findStepUpGrantByTokenHash(tokenHash: string, at = now) {
    const grant = this.grants.get(tokenHash);
    if (!grant || grant.revokedAt || grant.expiresAt <= at) return null;
    return grant;
  }

  async revokeStepUpGrant(tokenHash: string, revokedAt = now) {
    const grant = this.grants.get(tokenHash);
    if (grant) this.grants.set(tokenHash, { ...grant, revokedAt });
  }

  async recordSecurityEvent(event: unknown) {
    this.events.push(event);
  }
}

function makeRequest(body?: unknown, cookie?: string) {
  return new NextRequest("http://localhost/api/v1/admin/auth/login", {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function fixtureRepository() {
  const repository = new InMemoryAdminAuthRepository();
  const password = "correct horse battery staple";
  const { passwordHash } = await hashAdminPassword(password);
  repository.addUser({
    id: "admin-user-1",
    tenantId: "tenant-1",
    organizationId: "org-1",
    emailHash: hashAdminEmail("admin@example.com", hmacKey),
    passwordHash,
    status: "active",
    mfaRequired: true,
    roles: [Role.ORGANIZATION_OWNER],
    permissions: ["election.read", "election.open", "result.publish"]
  });
  return { repository, password };
}

describe("admin password and DB-backed session policy", () => {
  it("verifies scrypt password hashes and rejects wrong passwords generically", async () => {
    const { repository, password } = await fixtureRepository();
    const result = await loginAdmin({
      email: "admin@example.com",
      password,
      repository,
      context: { hmacKey, now }
    });
    expect(result.session.userId).toBe("admin-user-1");
    await expect(
      loginAdmin({
        email: "admin@example.com",
        password: "wrong password",
        repository,
        context: { hmacKey, now }
      })
    ).rejects.toMatchObject({
      code: "unauthorized",
      userMessage: "인증 정보를 확인할 수 없습니다."
    });
    await expect(
      loginAdmin({
        email: "missing@example.com",
        password: "wrong password",
        repository,
        context: { hmacKey, now }
      })
    ).rejects.toMatchObject({
      code: "unauthorized",
      userMessage: "인증 정보를 확인할 수 없습니다."
    });
  });

  it("stores only session hashes and keeps tokens out of events and responses", async () => {
    const { repository, password } = await fixtureRepository();
    const result = await loginAdmin({
      email: "admin@example.com",
      password,
      repository,
      context: { hmacKey, now, ipAddress: "203.0.113.5", userAgent: "Mozilla/5.0 Test" }
    });
    const token = result.sessionCookie.value;
    const tokenHash = hashAdminOpaqueToken(token, hmacKey);
    expect(repository.sessions.has(tokenHash)).toBe(true);
    expect(repository.sessions.has(token)).toBe(false);
    expect(JSON.stringify(result)).not.toContain(tokenHash);
    expect(JSON.stringify(repository.events)).not.toContain(token);
    expect(JSON.stringify(repository.events)).not.toContain(password);
    assertAdminAuthResultContainsNoSecrets({ admin: result.session });
  });

  it("restores, touches, and revokes admin sessions", async () => {
    const { repository, password } = await fixtureRepository();
    const result = await loginAdmin({
      email: "admin@example.com",
      password,
      repository,
      context: { hmacKey, now }
    });
    const restored = await restoreAdminSession({
      sessionToken: result.sessionCookie.value,
      repository,
      context: { hmacKey, now: new Date("2026-01-01T00:01:00.000Z") }
    });
    expect(restored?.session.permissions).toContain("election.read");
    await logoutAdmin({
      sessionToken: result.sessionCookie.value,
      repository,
      context: { hmacKey, now: new Date("2026-01-01T00:02:00.000Z") }
    });
    const afterLogout = await restoreAdminSession({
      sessionToken: result.sessionCookie.value,
      repository,
      context: { hmacKey, now: new Date("2026-01-01T00:03:00.000Z") }
    });
    expect(afterLogout).toBeNull();
  });

  it("creates scoped step-up grants without exposing step-up token hashes", async () => {
    const { repository, password } = await fixtureRepository();
    const login = await loginAdmin({
      email: "admin@example.com",
      password,
      repository,
      context: { hmacKey, now }
    });
    expect(() => requirePermissionWithStepUp(login.session, "election.open", now)).toThrow();
    const stepUp = await createPasswordStepUpGrant({
      sessionToken: login.sessionCookie.value,
      password,
      permissionCodes: ["election.open"],
      purpose: "open election",
      repository,
      context: { hmacKey, now: new Date("2026-01-01T00:05:00.000Z") }
    });
    expect(stepUp.session.stepUp?.permissionCodes).toEqual(["election.open"]);
    const stepUpToken = stepUp.stepUpCookie.value;
    expect(repository.grants.has(hashAdminOpaqueToken(stepUpToken, hmacKey))).toBe(true);
    expect(JSON.stringify(stepUp)).not.toContain(hashAdminOpaqueToken(stepUpToken, hmacKey));
    expect(JSON.stringify(repository.events)).not.toContain(stepUpToken);
  });

  it("does not create local development mock admin sessions in production", () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      expect(createLocalDevelopmentAdminSession()).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete env.NODE_ENV;
      } else {
        env.NODE_ENV = previous;
      }
    }
  });
});

describe("admin auth route handlers", () => {
  it("sets HttpOnly session cookie on login and me returns roles and permissions", async () => {
    const { repository, password } = await fixtureRepository();
    const dependencies = { repository, hmacKey, now };
    const loginResponse = await handleAdminLoginRoute(
      makeRequest({ email: "admin@example.com", password }),
      dependencies
    );
    const loginJson = await loginResponse.json();
    expect(loginJson.ok).toBe(true);
    expect(JSON.stringify(loginJson)).not.toContain(password);
    const setCookie = loginResponse.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${ADMIN_SESSION_COOKIE_POLICY.name}=`);
    expect(setCookie).toContain("HttpOnly");
    const cookiePair = setCookie.split(";")[0];
    const meResponse = await handleAdminMeRoute(makeRequest(undefined, cookiePair), dependencies);
    const meJson = await meResponse.json();
    expect(meJson.data.admin.roles).toContain(Role.ORGANIZATION_OWNER);
    expect(meJson.data.admin.permissions).toContain("election.read");
  });

  it("returns a step-up cookie without returning the raw token in JSON", async () => {
    const { repository, password } = await fixtureRepository();
    const dependencies = { repository, hmacKey, now };
    const loginResponse = await handleAdminLoginRoute(
      makeRequest({ email: "admin@example.com", password }),
      dependencies
    );
    const cookiePair = (loginResponse.headers.get("set-cookie") ?? "").split(";")[0];
    const stepUpResponse = await handleAdminStepUpRoute(
      makeRequest({ password, permissionCodes: ["result.publish"], purpose: "publish result" }, cookiePair),
      dependencies
    );
    const stepUpJson = await stepUpResponse.json();
    expect(stepUpJson.data.step_up.permission_codes).toEqual(["result.publish"]);
    expect(stepUpResponse.headers.get("set-cookie")).toContain("admin_step_up=");
    expect(JSON.stringify(stepUpJson)).not.toMatch(/token|hash|password/i);
  });

  it("lets existing admin route handlers use an authenticated session boundary", async () => {
    const repository = {
      listElections: async () => []
    } as Partial<ElectionRepository> as ElectionRepository;
    const session = createMockAdminSession({ permissions: ["election.read"] });
    const response = await handleListElectionsRoute({ repository, hmacKey, session });
    const json = await response.json();
    expect(json).toEqual({ ok: true, data: [] });
  });
});
