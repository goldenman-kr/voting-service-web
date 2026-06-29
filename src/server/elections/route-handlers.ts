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
import { createPrismaElectionRepository } from "./prisma-repository";
import type { ElectionRepository } from "./repository";
import {
  approveElectionReview,
  closeElection,
  configureAuthenticationPolicy,
  createElectionDraft,
  createOption,
  createQuestion,
  getElection,
  issueInvitations,
  importEligibleVoters,
  listElections,
  openElection,
  pauseElection,
  prepareInvitationsForElection,
  requestElectionReview,
  resendInvitation,
  resumeElection,
  scheduleElection,
  updateElectionDraft,
  updateOption,
  updateQuestion,
  type ElectionServiceContext
} from "./election-service";

export type AdminElectionRouteDependencies = Readonly<{
  repository: ElectionRepository;
  hmacKey: string;
  session?: AdminSession;
  resolveSession?: () => Promise<AdminSession | undefined>;
  auditRecorder?: AuditRecorder;
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

export function createProductionAdminElectionDependencies(): AdminElectionRouteDependencies {
  try {
    const env = parseEnv();
    const prisma = getPrismaClient();
    return Object.freeze({
      repository: createPrismaElectionRepository(prisma),
      hmacKey: env.HMAC_KEY,
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
      throw serverConfigurationError("missing or invalid admin election environment");
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

async function serviceContext(dependencies: AdminElectionRouteDependencies): Promise<ElectionServiceContext> {
  const session = dependencies.session ?? (await dependencies.resolveSession?.());
  if (!session) {
    throw createAuthenticationError("missing admin session");
  }
  return {
    session,
    repository: dependencies.repository,
    auditRecorder: dependencies.auditRecorder,
    hmacKey: dependencies.hmacKey,
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

export async function handleCreateElectionRoute(
  request: NextRequest,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () => createElectionDraft(await parseJson(request), await serviceContext(dependencies)));
}

export async function handleListElectionsRoute(dependencies: AdminElectionRouteDependencies) {
  return run(async () => listElections(await serviceContext(dependencies)));
}

export async function handleGetElectionRoute(
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () => getElection(electionId, await serviceContext(dependencies)));
}

export async function handleUpdateElectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    updateElectionDraft(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleCreateQuestionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () => createQuestion(electionId, await parseJson(request), await serviceContext(dependencies)));
}

export async function handleUpdateQuestionRoute(
  request: NextRequest,
  electionId: string,
  questionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    updateQuestion(electionId, questionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleCreateOptionRoute(
  request: NextRequest,
  electionId: string,
  questionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    createOption(electionId, questionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleUpdateOptionRoute(
  request: NextRequest,
  electionId: string,
  questionId: string,
  optionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    updateOption(electionId, questionId, optionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleConfigureAuthenticationPolicyRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    configureAuthenticationPolicy(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleImportVoterRegistryRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    importEligibleVoters(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleRequestElectionReviewRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    requestElectionReview(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleApproveElectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    approveElectionReview(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleScheduleElectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    scheduleElection(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleOpenElectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    openElection(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handlePauseElectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    pauseElection(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleResumeElectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    resumeElection(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleCloseElectionRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    closeElection(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handlePrepareInvitationsRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    prepareInvitationsForElection(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleSendInvitationsRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    issueInvitations(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}

export async function handleResendInvitationRoute(
  request: NextRequest,
  electionId: string,
  dependencies: AdminElectionRouteDependencies
) {
  return run(async () =>
    resendInvitation(electionId, await parseJson(request), await serviceContext(dependencies))
  );
}
