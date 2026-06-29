import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { parseEnv } from "../../lib/env";
import { VOTER_SESSION_COOKIE_POLICY } from "../auth/voter-session";
import { getPrismaClient } from "../db/prisma";
import { ApiError, normalizeApiError } from "../http/errors";
import { apiError, apiSuccess } from "../http/response";
import { BALLOT_GROUP_COOKIE_POLICY } from "./ballot-group-token";
import {
  getVoterCompletionStatus,
  getVoterElectionInfo,
  submitAnonymousBallot,
  submitRevote,
  type VoterRequestContext
} from "./ballot-service";
import { createPrismaBallotRepository } from "./prisma-repository";
import type { BallotRepository } from "./repository";

export type VoterBallotRouteDependencies = Readonly<{
  repository: BallotRepository;
  hmacKey: string;
  now?: Date;
}>;

function serverConfigurationError(reason: string): ApiError {
  return new ApiError({
    status: 500,
    code: "internal_error",
    userMessage: "서버 투표 설정이 완료되지 않았습니다.",
    internalReason: reason
  });
}

export function createProductionVoterBallotDependencies(): VoterBallotRouteDependencies {
  try {
    const env = parseEnv();
    return Object.freeze({
      repository: createPrismaBallotRepository(getPrismaClient()),
      hmacKey: env.HMAC_KEY
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw serverConfigurationError("missing or invalid voter ballot environment");
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

function getRequestIp(request: NextRequest): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}

function requestContext(
  request: NextRequest,
  dependencies: VoterBallotRouteDependencies
): VoterRequestContext {
  return {
    voterSessionHandle: request.cookies.get(VOTER_SESSION_COOKIE_POLICY.name)?.value,
    ballotGroupToken: request.cookies.get(BALLOT_GROUP_COOKIE_POLICY.name)?.value,
    hmacKey: dependencies.hmacKey,
    now: dependencies.now,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined
  };
}

async function run<T>(operation: () => Promise<T>) {
  try {
    return NextResponse.json(apiSuccess(await operation()));
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleGetVoterElectionInfoRoute(
  request: NextRequest,
  dependencies: VoterBallotRouteDependencies
) {
  return run(() => getVoterElectionInfo(dependencies.repository, requestContext(request, dependencies)));
}

export async function handleGetVoterCompletionStatusRoute(
  request: NextRequest,
  dependencies: VoterBallotRouteDependencies
) {
  return run(() => getVoterCompletionStatus(dependencies.repository, requestContext(request, dependencies)));
}

export async function handleSubmitBallotRoute(
  request: NextRequest,
  dependencies: VoterBallotRouteDependencies
) {
  try {
    const result = await submitAnonymousBallot(
      dependencies.repository,
      await parseJson(request),
      requestContext(request, dependencies)
    );
    const response = NextResponse.json(apiSuccess(result.response));
    if (result.ballotGroupCookie) {
      response.cookies.set(result.ballotGroupCookie.name, result.ballotGroupCookie.value, {
        httpOnly: BALLOT_GROUP_COOKIE_POLICY.httpOnly,
        secure: BALLOT_GROUP_COOKIE_POLICY.secure,
        sameSite: BALLOT_GROUP_COOKIE_POLICY.sameSite,
        path: BALLOT_GROUP_COOKIE_POLICY.path,
        expires: result.ballotGroupCookie.expires
      });
    }
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleSubmitRevoteRoute(
  request: NextRequest,
  dependencies: VoterBallotRouteDependencies
) {
  try {
    const result = await submitRevote(
      dependencies.repository,
      await parseJson(request),
      requestContext(request, dependencies)
    );
    return NextResponse.json(apiSuccess(result.response));
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleProductionGetVoterElectionInfoRoute(request: NextRequest) {
  try {
    return await handleGetVoterElectionInfoRoute(request, createProductionVoterBallotDependencies());
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleProductionGetVoterCompletionStatusRoute(request: NextRequest) {
  try {
    return await handleGetVoterCompletionStatusRoute(request, createProductionVoterBallotDependencies());
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleProductionSubmitBallotRoute(request: NextRequest) {
  try {
    return await handleSubmitBallotRoute(request, createProductionVoterBallotDependencies());
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleProductionSubmitRevoteRoute(request: NextRequest) {
  try {
    return await handleSubmitRevoteRoute(request, createProductionVoterBallotDependencies());
  } catch (error) {
    return jsonError(error);
  }
}
