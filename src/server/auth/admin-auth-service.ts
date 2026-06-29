import { createHmac, randomBytes } from "node:crypto";

import { SecurityEventType } from "../../guardrails/index.js";
import { createSecurityEventPayload } from "../audit/security-event";
import { createAuthenticationError, createForbiddenError } from "../http/errors";
import { redactSensitiveValues } from "../privacy/redaction";
import {
  ADMIN_SESSION_COOKIE_POLICY,
  ADMIN_STEP_UP_COOKIE_POLICY,
  type AdminSession
} from "./admin-session";
import { verifyAdminPassword } from "./password";
import type {
  AdminAuthRepository,
  AdminSessionRecord,
  AdminStepUpGrantRecord,
  AdminUserAuthRecord,
  RestoredAdminSession
} from "./repository";

export const ADMIN_SESSION_TTL_MINUTES = 8 * 60;
export const ADMIN_STEP_UP_TTL_MINUTES = 10;

export type AdminAuthRequestContext = Readonly<{
  hmacKey: string;
  now?: Date;
  ipAddress?: string;
  userAgent?: string;
}>;

export type LoginResult = Readonly<{
  session: AdminSession;
  sessionCookie: Readonly<{
    name: string;
    value: string;
    expires: Date;
  }>;
}>;

export type StepUpResult = Readonly<{
  session: AdminSession;
  stepUpCookie: Readonly<{
    name: string;
    value: string;
    expires: Date;
  }>;
}>;

function nowFrom(context: AdminAuthRequestContext): Date {
  return context.now ?? new Date();
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashAdminEmail(email: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(normalizeAdminEmail(email)).digest("hex");
}

export function hashAdminOpaqueToken(token: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(token).digest("hex");
}

function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function assertActiveUser(user: AdminUserAuthRecord | null): asserts user is AdminUserAuthRecord {
  if (!user || user.status !== "active") {
    throw createAuthenticationError("admin login failed");
  }
}

async function recordSecurityEvent(
  repository: AdminAuthRepository,
  context: AdminAuthRequestContext,
  input: {
    tenantId?: string;
    actorId?: string;
    eventType: "login_success" | "login_failed" | "step_up_success" | "step_up_failed" | "permission_denied";
    riskLevel: "low" | "medium" | "high" | "critical";
    metadata?: Record<string, unknown>;
  }
) {
  await repository.recordSecurityEvent(
    createSecurityEventPayload({
      tenantId: input.tenantId,
      actorType: "admin",
      actorId: input.actorId,
      eventType: input.eventType,
      riskLevel: input.riskLevel,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: input.metadata ? redactSensitiveValues(input.metadata) : undefined,
      occurredAt: nowFrom(context)
    })
  );
}

function createSessionDto({
  sessionRecord,
  user,
  grants,
  now
}: {
  sessionRecord: AdminSessionRecord;
  user: AdminUserAuthRecord;
  grants?: readonly AdminStepUpGrantRecord[];
  now: Date;
}): AdminSession {
  const activeGrants = (grants ?? []).filter(
    (grant) => !grant.revokedAt && grant.expiresAt.getTime() > now.getTime()
  );
  const permissionCodes = Array.from(
    new Set(activeGrants.flatMap((grant) => Array.from(grant.permissionCodes)))
  ).sort();
  const latestGrant = activeGrants
    .slice()
    .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];

  return Object.freeze({
    sessionId: sessionRecord.id,
    actor: "admin" as const,
    userId: user.id,
    tenantId: user.tenantId,
    organizationId: user.organizationId ?? undefined,
    roles: user.roles,
    permissions: user.permissions,
    issuedAt: sessionRecord.issuedAt,
    expiresAt: sessionRecord.expiresAt,
    stepUp:
      latestGrant && permissionCodes.length > 0
        ? {
            verifiedAt: latestGrant.verifiedAt,
            expiresAt: latestGrant.expiresAt,
            purpose: latestGrant.purpose ?? undefined,
            permissionCodes
          }
        : undefined
  });
}

export async function loginAdmin({
  email,
  password,
  repository,
  context
}: {
  email: string;
  password: string;
  repository: AdminAuthRepository;
  context: AdminAuthRequestContext;
}): Promise<LoginResult> {
  const now = nowFrom(context);
  const emailHash = hashAdminEmail(email, context.hmacKey);
  const user = await repository.findUserByEmailHash(emailHash);

  try {
    assertActiveUser(user);
    const passwordMatched = await verifyAdminPassword(password, user.passwordHash);
    if (!passwordMatched) {
      throw createAuthenticationError("admin login failed");
    }
  } catch (error) {
    await recordSecurityEvent(repository, context, {
      tenantId: user?.tenantId,
      actorId: user?.id,
      eventType: SecurityEventType.LOGIN_FAILED,
      riskLevel: "medium",
      metadata: { reason: "invalid_credentials" }
    });
    throw createAuthenticationError("admin login failed");
  }

  const token = createOpaqueToken();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MINUTES * 60_000);
  const sessionRecord = await repository.createAdminSession({
    userId: user.id,
    sessionTokenHash: hashAdminOpaqueToken(token, context.hmacKey),
    issuedAt: now,
    expiresAt
  });
  const session = createSessionDto({ sessionRecord, user, now });
  await recordSecurityEvent(repository, context, {
    tenantId: user.tenantId,
    actorId: user.id,
    eventType: SecurityEventType.LOGIN_SUCCESS,
    riskLevel: "low",
    metadata: { mfaRequired: user.mfaRequired }
  });

  return Object.freeze({
    session,
    sessionCookie: {
      name: ADMIN_SESSION_COOKIE_POLICY.name,
      value: token,
      expires: expiresAt
    }
  });
}

export async function restoreAdminSession({
  sessionToken,
  repository,
  context
}: {
  sessionToken?: string;
  repository: AdminAuthRepository;
  context: AdminAuthRequestContext;
}): Promise<RestoredAdminSession | null> {
  if (!sessionToken) {
    return null;
  }
  const now = nowFrom(context);
  const tokenHash = hashAdminOpaqueToken(sessionToken, context.hmacKey);
  const sessionRecord = await repository.findAdminSessionByTokenHash(tokenHash, now);
  if (!sessionRecord) {
    return null;
  }
  const user = await repository.findUserById(sessionRecord.userId);
  if (!user || user.status !== "active") {
    return null;
  }
  const grants = await repository.findActiveStepUpGrantsForSession(sessionRecord.id, now);
  await repository.touchAdminSession(tokenHash, now);
  return Object.freeze({
    session: createSessionDto({ sessionRecord, user, grants, now }),
    sessionRecord
  });
}

export async function logoutAdmin({
  sessionToken,
  repository,
  context
}: {
  sessionToken?: string;
  repository: AdminAuthRepository;
  context: AdminAuthRequestContext;
}): Promise<void> {
  if (!sessionToken) {
    return;
  }
  const restored = await restoreAdminSession({ sessionToken, repository, context });
  await repository.revokeAdminSession(hashAdminOpaqueToken(sessionToken, context.hmacKey), nowFrom(context));
  if (restored) {
    await recordSecurityEvent(repository, context, {
      tenantId: restored.session.tenantId,
      actorId: restored.session.userId,
      eventType: SecurityEventType.LOGIN_SUCCESS,
      riskLevel: "low",
      metadata: { action: "admin_logout_session_revoked" }
    });
  }
}

export async function createPasswordStepUpGrant({
  sessionToken,
  password,
  permissionCodes,
  purpose,
  repository,
  context
}: {
  sessionToken?: string;
  password: string;
  permissionCodes: readonly string[];
  purpose?: string;
  repository: AdminAuthRepository;
  context: AdminAuthRequestContext;
}): Promise<StepUpResult> {
  const restored = await restoreAdminSession({ sessionToken, repository, context });
  if (!restored) {
    throw createAuthenticationError("missing admin session for step-up");
  }
  const user = await repository.findUserById(restored.session.userId);
  assertActiveUser(user);
  const passwordMatched = await verifyAdminPassword(password, user.passwordHash);
  if (!passwordMatched) {
    await recordSecurityEvent(repository, context, {
      tenantId: user.tenantId,
      actorId: user.id,
      eventType: SecurityEventType.STEP_UP_FAILED,
      riskLevel: "high",
      metadata: { reason: "password_recheck_failed" }
    });
    throw createAuthenticationError("step-up failed");
  }
  if (permissionCodes.length === 0) {
    throw createForbiddenError("step-up requires at least one permission scope");
  }

  const now = nowFrom(context);
  const token = createOpaqueToken();
  const expiresAt = new Date(now.getTime() + ADMIN_STEP_UP_TTL_MINUTES * 60_000);
  const grant = await repository.createStepUpGrant({
    adminSessionId: restored.sessionRecord.id,
    userId: user.id,
    tokenHash: hashAdminOpaqueToken(token, context.hmacKey),
    permissionCodes: Array.from(new Set(permissionCodes)).sort(),
    purpose,
    verifiedAt: now,
    expiresAt
  });
  await recordSecurityEvent(repository, context, {
    tenantId: user.tenantId,
    actorId: user.id,
    eventType: SecurityEventType.STEP_UP_SUCCESS,
    riskLevel: "medium",
    metadata: { permissionCount: grant.permissionCodes.length, purpose }
  });

  const session = createSessionDto({
    sessionRecord: restored.sessionRecord,
    user,
    grants: [grant],
    now
  });

  return Object.freeze({
    session,
    stepUpCookie: {
      name: ADMIN_STEP_UP_COOKIE_POLICY.name,
      value: token,
      expires: expiresAt
    }
  });
}

export function assertAdminAuthResultContainsNoSecrets(value: unknown): void {
  const serialized = JSON.stringify(value);
  if (/password|sessionTokenHash|tokenHash|session_token_hash|token_hash/i.test(serialized)) {
    throw new Error("admin auth response must not contain password or token hash material");
  }
}
