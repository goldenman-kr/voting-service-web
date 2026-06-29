import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";

import { parseEnv } from "../../lib/env";
import type { AuditRecorder } from "../audit/audit-event";
import { ADMIN_SESSION_COOKIE_POLICY, type AdminSession } from "../auth/admin-session";
import { restoreAdminSession } from "../auth/admin-auth-service";
import { createPrismaAdminAuthRepository } from "../auth/prisma-repository";
import { getPrismaClient } from "../db/prisma";
import { ApiError, createAuthenticationError, normalizeApiError } from "../http/errors";
import { apiError, apiSuccess } from "../http/response";
import { createPrismaResultRepository } from "./prisma-repository";
import type { ResultRepository } from "./repository";
import {
  approveCorrection,
  confirmResult,
  createReportExportRequest,
  getElectionResult,
  getPublicElectionResult,
  getReportExportDownloadInfo,
  invalidateElectionResult,
  publishResult,
  requestCorrection,
  tallyElectionResult,
  type PublicResultContext,
  type ResultServiceContext
} from "./result-service";

export type AdminResultRouteDependencies = Readonly<{
  repository: ResultRepository;
  session?: AdminSession;
  resolveSession?: () => Promise<AdminSession | undefined>;
  auditRecorder?: AuditRecorder;
  now?: Date;
}>;

export type PublicResultRouteDependencies = Readonly<{
  repository: ResultRepository;
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

export function createProductionAdminResultDependencies(): AdminResultRouteDependencies {
  try {
    const env = parseEnv();
    const prisma = getPrismaClient();
    return Object.freeze({
      repository: createPrismaResultRepository(prisma),
      resolveSession: async () => {
        const cookieStore = await cookies();
        const token = cookieStore.get(ADMIN_SESSION_COOKIE_POLICY.name)?.value;
        const restored = await restoreAdminSession({
          sessionToken: token,
          repository: createPrismaAdminAuthRepository(prisma),
          context: { hmacKey: env.HMAC_KEY, now: new Date() }
        });
        return restored?.session;
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw serverConfigurationError("missing or invalid admin result environment");
    }
    throw error;
  }
}

export function createProductionPublicResultDependencies(): PublicResultRouteDependencies {
  try {
    parseEnv();
    return Object.freeze({
      repository: createPrismaResultRepository(getPrismaClient())
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw serverConfigurationError("missing or invalid public result environment");
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

async function adminContext(dependencies: AdminResultRouteDependencies): Promise<ResultServiceContext> {
  const session = dependencies.session ?? (await dependencies.resolveSession?.());
  if (!session) {
    throw createAuthenticationError("missing admin session");
  }
  return {
    session,
    repository: dependencies.repository,
    auditRecorder: dependencies.auditRecorder,
    now: dependencies.now
  };
}

function publicContext(dependencies: PublicResultRouteDependencies): PublicResultContext {
  return {
    repository: dependencies.repository,
    now: dependencies.now
  };
}

async function run<T>(operation: () => Promise<T>) {
  try {
    return NextResponse.json(apiSuccess(await operation()));
  } catch (error) {
    return jsonError(error);
  }
}

export async function handleTallyResultRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () => tallyElectionResult(electionId, await parseJson(request), await adminContext(dependencies)));
}

export async function handleGetResultRoute(
  electionId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () => getElectionResult(electionId, await adminContext(dependencies)));
}

export async function handleConfirmResultRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () => confirmResult(electionId, await parseJson(request), await adminContext(dependencies)));
}

export async function handlePublishResultRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () => publishResult(electionId, await parseJson(request), await adminContext(dependencies)));
}

export async function handleRequestCorrectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () => requestCorrection(electionId, await parseJson(request), await adminContext(dependencies)));
}

export async function handleApproveCorrectionRoute(
  request: NextRequest,
  electionId: string,
  correctionId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () =>
    approveCorrection(electionId, correctionId, await parseJson(request), await adminContext(dependencies))
  );
}

export async function handleInvalidateElectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () =>
    invalidateElectionResult(electionId, await parseJson(request), await adminContext(dependencies))
  );
}

export async function handleCreateReportExportRequestRoute(
  request: NextRequest,
  reportId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () =>
    createReportExportRequest(reportId, await parseJson(request), await adminContext(dependencies))
  );
}

export async function handleGetReportExportDownloadRoute(
  exportId: string,
  dependencies: AdminResultRouteDependencies
) {
  return run(async () => getReportExportDownloadInfo(exportId, await adminContext(dependencies)));
}

export async function handleGetPublicResultRoute(
  electionId: string,
  dependencies: PublicResultRouteDependencies
) {
  return run(() => getPublicElectionResult(electionId, publicContext(dependencies)));
}

export async function handleGetVoterResultRoute(
  dependencies: PublicResultRouteDependencies,
  electionId?: string
) {
  if (!electionId) {
    return jsonError(
      new ApiError({
        status: 400,
        code: "bad_request",
        userMessage: "투표 정보를 확인할 수 없습니다.",
        internalReason: "voter result route requires election_id query"
      })
    );
  }
  return handleGetPublicResultRoute(electionId, dependencies);
}
