import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { parseEnv } from "../../lib/env";
import { VOTER_SESSION_COOKIE_POLICY, hashOpaqueHandle } from "../auth/voter-session";
import { createSecurityEventPayload } from "../audit/security-event";
import { getPrismaClient } from "../db/prisma";
import { ApiError, createAuthenticationError, normalizeApiError } from "../http/errors";
import { apiError, apiSuccess } from "../http/response";
import { createPrismaVoterAuthRepository } from "./prisma-repository";
import type { VoterAuthRepository } from "./repository";
import {
  verifyInvitationToken,
  verifyVoterIdentifier
} from "./voter-auth-service";

export type VoterAuthRouteDependencies = Readonly<{
  repository: VoterAuthRepository;
  hmacKey: string;
  now?: Date;
}>;

function serverConfigurationError(reason: string): ApiError {
  return new ApiError({
    status: 500,
    code: "internal_error",
    userMessage: "서버 인증 설정이 완료되지 않았습니다.",
    internalReason: reason
  });
}

export function createProductionVoterAuthDependencies(): VoterAuthRouteDependencies {
  try {
    const env = parseEnv();
    return Object.freeze({
      repository: createPrismaVoterAuthRepository(getPrismaClient()),
      hmacKey: env.HMAC_KEY
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw serverConfigurationError("missing or invalid voter auth environment");
    }
    throw error;
  }
}

export async function handleProductionInvitationVerifyRoute(request: NextRequest) {
  try {
    return await handleInvitationVerifyRoute(request, createProductionVoterAuthDependencies());
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleProductionIdentifierVerifyRoute(request: NextRequest) {
  try {
    return await handleIdentifierVerifyRoute(request, createProductionVoterAuthDependencies());
  } catch (error) {
    return jsonError(error);
  }
}

function jsonError(error: unknown) {
  const normalized = normalizeApiError(error);
  return NextResponse.json(apiError(normalized), { status: normalized.status });
}

function getRequestIp(request: NextRequest): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}

async function recordVoterSecurityEvent({
  request,
  repository,
  eventType,
  riskLevel,
  metadata
}: {
  request: NextRequest;
  repository: VoterAuthRepository;
  eventType: "suspicious_access" | "account_locked";
  riskLevel: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}) {
  await repository.recordSecurityEvent?.(
    createSecurityEventPayload({
      actorType: "voter",
      eventType,
      riskLevel,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata,
      occurredAt: new Date()
    })
  );
}

export async function handleInvitationVerifyRoute(
  request: NextRequest,
  dependencies: VoterAuthRouteDependencies
) {
  const body = (await request.json().catch(() => ({}))) as { invite_token?: string };

  if (!body.invite_token) {
    return jsonError(
      new ApiError({
        status: 400,
        code: "bad_request",
        userMessage: "초대 정보를 확인할 수 없습니다.",
        internalReason: "missing invite_token in body"
      })
    );
  }

  try {
    const result = await verifyInvitationToken({
      inviteToken: body.invite_token,
      hmacKey: dependencies.hmacKey,
      repository: dependencies.repository,
      now: dependencies.now
    });

    const response = NextResponse.json(
      apiSuccess({
        authentication_method: result.authenticationMethod,
        requires_identifier: result.requiresIdentifier,
        requires_one_time_code: result.requiresOneTimeCode,
        session: {
          authenticated: result.voterSession.authenticated,
          expires_at: result.voterSession.expiresAt.toISOString()
        }
      })
    );

    response.cookies.set(VOTER_SESSION_COOKIE_POLICY.name, result.opaqueHandle, {
      httpOnly: VOTER_SESSION_COOKIE_POLICY.httpOnly,
      secure: VOTER_SESSION_COOKIE_POLICY.secure,
      sameSite: VOTER_SESSION_COOKIE_POLICY.sameSite,
      path: VOTER_SESSION_COOKIE_POLICY.path,
      expires: result.voterSession.expiresAt
    });

    return response;
  } catch (error) {
    await recordVoterSecurityEvent({
      request,
      repository: dependencies.repository,
      eventType: "suspicious_access",
      riskLevel: "medium",
      metadata: { action: "voter.invitation.verify.failed" }
    });
    return jsonError(error);
  }
}

export async function handleIdentifierVerifyRoute(
  request: NextRequest,
  dependencies: VoterAuthRouteDependencies
) {
  const body = (await request.json().catch(() => ({}))) as {
    identifier?: string;
  };

  if (!body.identifier) {
    return jsonError(
      new ApiError({
        status: 400,
        code: "bad_request",
        userMessage: "인증 정보를 확인할 수 없습니다.",
        internalReason: "missing voter identifier in body"
      })
    );
  }

  const opaqueHandle = request.cookies.get(VOTER_SESSION_COOKIE_POLICY.name)?.value;
  if (!opaqueHandle) {
    return jsonError(createAuthenticationError("missing voter session cookie"));
  }

  const handleHash = hashOpaqueHandle(opaqueHandle, dependencies.hmacKey);
  const voterSession = await dependencies.repository.findVoterSessionByHandleHash(
    handleHash,
    dependencies.now
  );

  if (!voterSession) {
    return jsonError(createAuthenticationError("voter session missing expired or revoked"));
  }

  try {
    const result = await verifyVoterIdentifier({
      voterSession,
      identifier: body.identifier,
      hmacKey: dependencies.hmacKey,
      repository: dependencies.repository,
      now: dependencies.now
    });

    await dependencies.repository.updateVoterSessionAuthentication({
      handleHash,
      authenticated: result.authenticated,
      identifierVerifiedAt: dependencies.now ?? new Date(),
      step: result.credentialUpdate.authStatus ?? "identifier_verified"
    });
    await dependencies.repository.touchVoterSession(handleHash, dependencies.now);

    return NextResponse.json(
      apiSuccess({
        authenticated: result.authenticated,
        next_step: result.credentialUpdate.authStatus,
        session: {
          authenticated: result.authenticated
        }
      })
    );
  } catch (error) {
    await recordVoterSecurityEvent({
      request,
      repository: dependencies.repository,
      eventType: "suspicious_access",
      riskLevel: "medium",
      metadata: { action: "voter.identifier.verify.failed" }
    });
    return jsonError(error);
  }
}
