"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getDefaultAuthenticationMethod,
  isAvailableInMvp,
  type AuthenticationMethodValue
} from "../../domain/auth-policy/authentication-policy";
import { ElectionState } from "../../guardrails/index.js";
import { parseEnv } from "../../lib/env";
import { getCurrentAdminSessionFromCookies } from "../auth/current-admin";
import { getPrismaClient } from "../db/prisma";
import { normalizeApiError } from "../http/errors";
import { createPrismaElectionRepository } from "./prisma-repository";
import {
  configureAuthenticationPolicy,
  createElectionDraft,
  createOption,
  createQuestion,
  approveElectionReview,
  closeElection,
  importEligibleVoters,
  issueInvitations,
  openElection,
  pauseElection,
  prepareInvitationsForElection,
  requestElectionReview,
  resendInvitation,
  resumeElection,
  scheduleElection,
  type ElectionServiceContext
} from "./election-service";
import { getAdminElectionDetail } from "./admin-election-view";

export type AdminActionState = Readonly<{
  ok: boolean;
  message?: string;
}>;

async function serviceContext(): Promise<ElectionServiceContext> {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) {
    throw new Error("missing admin session");
  }
  const env = parseEnv();
  return {
    session: restored.session,
    repository: createPrismaElectionRepository(getPrismaClient()),
    hmacKey: env.HMAC_KEY
  };
}

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string): string | undefined {
  const raw = value(formData, key);
  return raw.length > 0 ? raw : undefined;
}

function safeMessage(error: unknown): string {
  return normalizeApiError(error).userMessage;
}

export async function createElectionDraftAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  let electionId: string | undefined;
  try {
    const context = await serviceContext();
    const result = await createElectionDraft(
      {
        title: value(formData, "title"),
        description: optionalValue(formData, "description"),
        electionType: value(formData, "electionType") || "representative_election",
        votingMode: value(formData, "votingMode") || "anonymous",
        startsAt: value(formData, "startsAt"),
        endsAt: value(formData, "endsAt"),
        timezone: "Asia/Seoul"
      },
      context
    );
    electionId = result.election.id;
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/elections");
  redirect(`/admin/elections/${electionId}`);
}

export async function createQuestionWithOptionsAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  try {
    const context = await serviceContext();
    const detail = await getAdminElectionDetail(getPrismaClient(), context.session, electionId);
    const question = await createQuestion(
      electionId,
      {
        title: value(formData, "title"),
        questionType: "single_choice",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        displayOrder: detail?.questions.length ?? 0
      },
      context
    );
    const labels = value(formData, "options")
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const [index, label] of labels.entries()) {
      await createOption(electionId, question.id, { label, displayOrder: index }, context);
    }
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath(`/admin/elections/${electionId}`);
  revalidatePath(`/admin/elections/${electionId}/questions`);
  return { ok: true, message: "문항을 추가했습니다." };
}

export async function configureAuthenticationPolicyAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  try {
    const method = value(formData, "method") || getDefaultAuthenticationMethod();
    if (!isAvailableInMvp(method as AuthenticationMethodValue)) {
      return {
        ok: false,
        message: "현재 MVP에서 사용할 수 없는 인증 방식입니다."
      };
    }
    await configureAuthenticationPolicy(
      electionId,
      {
        method,
        isEnabled: true,
        reason: "관리자 UI 인증 정책 변경"
      },
      await serviceContext()
    );
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath(`/admin/elections/${electionId}`);
  revalidatePath(`/admin/elections/${electionId}/auth-policy`);
  return { ok: true, message: "인증 정책을 저장했습니다." };
}

function parseVoterRows(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, externalIdentifier, email] = line.split(/,|\t/).map((entry) => entry.trim());
      return {
        name: name || undefined,
        externalIdentifier,
        email: email || undefined
      };
    });
}

export async function importVoterRegistryAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  try {
    const result = await importEligibleVoters(
      electionId,
      {
        sourceType: "manual",
        rows: parseVoterRows(value(formData, "rows")),
        reason: "관리자 UI 명부 등록"
      },
      await serviceContext()
    );
    revalidatePath(`/admin/elections/${electionId}`);
    revalidatePath(`/admin/elections/${electionId}/voters`);
    return {
      ok: result.errorCount === 0,
      message:
        result.errorCount === 0
          ? `명부 ${result.validRows}건을 등록했습니다.`
          : `명부 검증 결과 중복 또는 오류 ${result.errorCount}건이 있습니다. 원문 식별자는 표시하지 않습니다.`
    };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

function reviewMissingItems(detail: Awaited<ReturnType<typeof getAdminElectionDetail>>): string[] {
  if (!detail) return ["투표 정보를 찾을 수 없습니다."];
  const missing: string[] = [];
  if (!detail.title.trim()) missing.push("투표 제목");
  if (!(detail.startsAt instanceof Date) || !(detail.endsAt instanceof Date)) missing.push("투표 일정");
  if (detail.questions.length === 0) missing.push("문항");
  if (detail.questions.some((question) => question.questionType !== "free_text" && question.options.length === 0)) {
    missing.push("문항 선택지");
  }
  if (!detail.voterRegistry || detail.voterRegistry.validRows === 0) missing.push("유권자 명부");
  return missing;
}

export async function requestReviewAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  try {
    const context = await serviceContext();
    const detail = await getAdminElectionDetail(getPrismaClient(), context.session, electionId);
    const missing = reviewMissingItems(detail);
    if (missing.length > 0) {
      return {
        ok: false,
        message: `검수 요청 전 누락 항목을 확인해 주세요: ${missing.join(", ")}`
      };
    }
    if (detail?.state !== ElectionState.DRAFT) {
      return { ok: false, message: "Draft 상태에서만 검수 요청할 수 있습니다." };
    }
    await requestElectionReview(electionId, { reason: value(formData, "reason") || "검수 요청" }, context);
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/elections");
  revalidatePath(`/admin/elections/${electionId}`);
  return { ok: true, message: "검수 요청을 보냈습니다." };
}

type ElectionOperation =
  | "approve"
  | "schedule"
  | "open"
  | "pause"
  | "resume"
  | "close"
  | "prepare_invitations"
  | "send_invitations"
  | "resend_invitations";

const electionOperationMessages: Record<ElectionOperation, string> = {
  approve: "투표를 승인했습니다.",
  schedule: "투표를 예약 상태로 전환했습니다.",
  open: "투표를 시작했습니다.",
  pause: "투표를 일시중단했습니다.",
  resume: "투표를 재개했습니다.",
  close: "투표를 종료했습니다.",
  prepare_invitations: "초대와 투표 자격을 준비했습니다.",
  send_invitations: "초대 발송 요청을 처리했습니다.",
  resend_invitations: "초대 재발송 요청을 처리했습니다."
};

export async function electionOperationAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  const operation = value(formData, "operation") as ElectionOperation;
  const reason = value(formData, "reason");
  try {
    const context = await serviceContext();
    switch (operation) {
      case "approve":
        await approveElectionReview(electionId, { reason }, context);
        break;
      case "schedule":
        await scheduleElection(electionId, { reason }, context);
        break;
      case "open":
        await openElection(electionId, { reason }, context);
        break;
      case "pause":
        await pauseElection(electionId, { reason }, context);
        break;
      case "resume":
        await resumeElection(electionId, { reason }, context);
        break;
      case "close":
        await closeElection(electionId, { reason }, context);
        break;
      case "prepare_invitations":
        await prepareInvitationsForElection(electionId, { reason }, context);
        break;
      case "send_invitations":
        await issueInvitations(electionId, { reason, channel: "email" }, context);
        break;
      case "resend_invitations":
        await resendInvitation(electionId, { reason, channel: "email" }, context);
        break;
      default:
        return { ok: false, message: "지원하지 않는 작업입니다." };
    }
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/elections");
  revalidatePath(`/admin/elections/${electionId}`);
  revalidatePath(`/admin/elections/${electionId}/voters`);
  return { ok: true, message: electionOperationMessages[operation] };
}
