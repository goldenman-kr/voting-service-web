import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";

import { parseEnv } from "../../lib/env";
import { ADMIN_SESSION_COOKIE_POLICY, ADMIN_STEP_UP_COOKIE_POLICY } from "./admin-session";
import {
  assertAdminAuthResultContainsNoSecrets,
  createPasswordStepUpGrant,
  loginAdmin,
  logoutAdmin,
  restoreAdminSession
} from "./admin-auth-service";
import { createPrismaAdminAuthRepository } from "./prisma-repository";
import type { AdminAuthRepository } from "./repository";
import { getPrismaClient } from "../db/prisma";
import { ApiError, normalizeApiError } from "../http/errors";
import { apiError, apiSuccess } from "../http/response";

const loginInputSchema = z.object({
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024)
});

const stepUpInputSchema = z.object({
  password: z.string().min(1).max(1024),
  permissionCodes: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
  purpose: z.string().trim().max(500).optional()
});

export type AdminAuthRouteDependencies = Readonly<{
  repository: AdminAuthRepository;
  hmacKey: string;
  now?: Date;
}>;

function serverConfigurationError(reason: string): ApiError {
  return new ApiError({
    status: 500,
    code: "internal_error",
    userMessage: "서버 설정이 완료되지 않았습니다.",
    internalReason: reason
  });
}

export function createProductionAdminAuthDependencies(): AdminAuthRouteDependencies {
  try {
    const env = parseEnv();
    return Object.freeze({
      repository: createPrismaAdminAuthRepository(getPrismaClient()),
      hmacKey: env.HMAC_KEY
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw serverConfigurationError("missing or invalid admin auth environment");
    }
    throw error;
  }
}

function jsonError(error: unknown) {
  const normalized = normalizeApiError(error);
  return NextResponse.json(apiError(normalized), { status: normalized.status });
}

async function parseJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}));
}

function requestContext(request: NextRequest, dependencies: AdminAuthRouteDependencies) {
  return {
    hmacKey: dependencies.hmacKey,
    now: dependencies.now,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: request.headers.get("user-agent") ?? undefined
  };
}

function adminSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get(ADMIN_SESSION_COOKIE_POLICY.name)?.value;
}

function adminMeDto(session: {
  userId: string;
  tenantId: string;
  organizationId?: string;
  roles: readonly string[];
  permissions: readonly string[];
  expiresAt: Date;
  stepUp?: { expiresAt: Date; permissionCodes?: readonly string[]; purpose?: string };
}) {
  return {
    user_id: session.userId,
    tenant_id: session.tenantId,
    organization_id: session.organizationId,
    roles: session.roles,
    permissions: session.permissions,
    expires_at: session.expiresAt.toISOString(),
    step_up: session.stepUp
      ? {
          expires_at: session.stepUp.expiresAt.toISOString(),
          permission_codes: session.stepUp.permissionCodes ?? [],
          purpose: session.stepUp.purpose
        }
      : null
  };
}

function setAdminSessionCookie(response: NextResponse, name: string, value: string, expires: Date) {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires
  });
}

function clearAdminCookie(response: NextResponse, name: string) {
  response.cookies.set({
    name,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    expires: new Date(0)
  });
}

export async function handleAdminLoginRoute(
  request: NextRequest,
  dependencies: AdminAuthRouteDependencies
) {
  try {
    const input = loginInputSchema.parse(await parseJson(request));
    const result = await loginAdmin({
      username: input.username,
      password: input.password,
      repository: dependencies.repository,
      context: requestContext(request, dependencies)
    });
    const body = {
      authenticated: true,
      admin: adminMeDto(result.session)
    };
    assertAdminAuthResultContainsNoSecrets(body);
    const response = NextResponse.json(apiSuccess(body));
    setAdminSessionCookie(
      response,
      result.sessionCookie.name,
      result.sessionCookie.value,
      result.sessionCookie.expires
    );
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleAdminLogoutRoute(
  request: NextRequest,
  dependencies: AdminAuthRouteDependencies
) {
  try {
    await logoutAdmin({
      sessionToken: adminSessionToken(request),
      repository: dependencies.repository,
      context: requestContext(request, dependencies)
    });
    const response = NextResponse.json(apiSuccess({ logged_out: true }));
    clearAdminCookie(response, ADMIN_SESSION_COOKIE_POLICY.name);
    clearAdminCookie(response, ADMIN_STEP_UP_COOKIE_POLICY.name);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleAdminMeRoute(
  request: NextRequest,
  dependencies: AdminAuthRouteDependencies
) {
  try {
    const restored = await restoreAdminSession({
      sessionToken: adminSessionToken(request),
      repository: dependencies.repository,
      context: requestContext(request, dependencies)
    });
    if (!restored) {
      throw new ApiError({
        status: 401,
        code: "unauthorized",
        userMessage: "인증 정보를 확인할 수 없습니다.",
        internalReason: "missing admin session"
      });
    }
    const body = { admin: adminMeDto(restored.session) };
    assertAdminAuthResultContainsNoSecrets(body);
    return NextResponse.json(apiSuccess(body));
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleAdminStepUpRoute(
  request: NextRequest,
  dependencies: AdminAuthRouteDependencies
) {
  try {
    const input = stepUpInputSchema.parse(await parseJson(request));
    const result = await createPasswordStepUpGrant({
      sessionToken: adminSessionToken(request),
      password: input.password,
      permissionCodes: input.permissionCodes,
      purpose: input.purpose,
      repository: dependencies.repository,
      context: requestContext(request, dependencies)
    });
    const body = {
      step_up: {
        granted: true,
        expires_at: result.session.stepUp?.expiresAt.toISOString(),
        permission_codes: result.session.stepUp?.permissionCodes ?? [],
        purpose: result.session.stepUp?.purpose
      }
    };
    assertAdminAuthResultContainsNoSecrets(body);
    const response = NextResponse.json(apiSuccess(body));
    setAdminSessionCookie(
      response,
      result.stepUpCookie.name,
      result.stepUpCookie.value,
      result.stepUpCookie.expires
    );
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
