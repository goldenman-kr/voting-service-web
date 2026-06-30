"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getDefaultAuthenticationMethod,
  isAvailableInMvp,
  type AuthenticationMethodValue
} from "../../domain/auth-policy/authentication-policy";
import { AuthenticationMethod, ElectionState } from "../../guardrails/index.js";
import { parseEnv } from "../../lib/env";
import {
  canonicalVoterIdentifier,
  parseVoterRegistryTextRows,
  validateVoterRegistryFields,
  type VoterRegistryFields
} from "../../lib/voter-registry-fields";
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
  updateElectionDraft,
  updateOption,
  updateQuestion,
  type ElectionServiceContext
} from "./election-service";
import { getAdminElectionDetail } from "./admin-election-view";
import { linkManagedRegistryToElection } from "../voter-registries/managed-registry-service";

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
    hmacKey: env.HMAC_KEY,
    encryptionKey: env.ENCRYPTION_KEY
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

function validateBasicInfoInput(formData: FormData): string | null {
  const requiredFields = [
    ["title", "투표 제목"],
    ["electionType", "투표 유형"],
    ["startsAt", "시작일시"],
    ["endsAt", "종료일시"]
  ] as const;
  for (const [key, label] of requiredFields) {
    if (!value(formData, key)) {
      return `${label}을 입력해 주세요.`;
    }
  }

  const startsAt = new Date(value(formData, "startsAt"));
  const endsAt = new Date(value(formData, "endsAt"));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "시작일시와 종료일시를 확인해 주세요.";
  }
  if (endsAt <= startsAt) {
    return "종료일시는 시작일시보다 뒤여야 합니다.";
  }
  return null;
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

export async function updateElectionBasicInfoAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  if (!electionId) {
    return { ok: false, message: "수정할 투표를 찾을 수 없습니다." };
  }
  const validationMessage = validateBasicInfoInput(formData);
  if (validationMessage) {
    return { ok: false, message: validationMessage };
  }

  try {
    const context = await serviceContext();
    const detail = await getAdminElectionDetail(getPrismaClient(), context.session, electionId);
    if (!detail) {
      return { ok: false, message: "투표 정보를 찾을 수 없습니다." };
    }
    if (detail.state !== ElectionState.DRAFT) {
      return {
        ok: false,
        message: "초안 상태의 투표만 통합 편집 화면에서 수정할 수 있습니다."
      };
    }
    if (detail.startsAt <= new Date()) {
      return {
        ok: false,
        message: "시작일시가 지난 투표는 통합 편집 화면에서 수정할 수 없습니다."
      };
    }
    await updateElectionDraft(
      electionId,
      {
        title: value(formData, "title"),
        description: optionalValue(formData, "description"),
        electionType: value(formData, "electionType") || "representative_election",
        startsAt: value(formData, "startsAt"),
        endsAt: value(formData, "endsAt"),
        timezone: "Asia/Seoul",
        reason: "통합 편집 마법사 기본 정보 수정"
      },
      context
    );
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/elections");
  revalidatePath(`/admin/elections/${electionId}`);
  revalidatePath(`/admin/elections/${electionId}/edit`);
  return {
    ok: true,
    message: "기본 정보가 저장되었습니다. 투표를 시작하기 전에 상세 화면에서 제목, 일정, 문항, 선택 항목, 선거인 명부를 다시 확인해 주세요."
  };
}

function rawValues(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((entry) => String(entry ?? "").trim());
}

function nonEmptyValues(formData: FormData, key: string): string[] {
  return rawValues(formData, key).filter(Boolean);
}

const wizardEnabledAuthMethods = new Set<string>([
  AuthenticationMethod.INVITE_LINK_ONLY,
  AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
]);

export async function updateElectionAuthPolicyFromWizardAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  const method = value(formData, "method") || getDefaultAuthenticationMethod();
  if (!electionId) {
    return { ok: false, message: "수정할 투표를 찾을 수 없습니다." };
  }
  if (!wizardEnabledAuthMethods.has(method) || !isAvailableInMvp(method as AuthenticationMethodValue)) {
    return {
      ok: false,
      message: "현재 MVP에서 사용할 수 없는 인증 방식입니다."
    };
  }

  try {
    const context = await serviceContext();
    const detail = await getAdminElectionDetail(getPrismaClient(), context.session, electionId);
    if (!detail) {
      return { ok: false, message: "투표 정보를 찾을 수 없습니다." };
    }
    if (detail.state !== ElectionState.DRAFT) {
      return {
        ok: false,
        message: "초안 상태의 투표만 투표 참여 인증 방식을 수정할 수 있습니다."
      };
    }
    if (detail.startsAt <= new Date()) {
      return {
        ok: false,
        message: "시작일시가 지난 투표는 투표 참여 인증 방식을 수정할 수 없습니다."
      };
    }

    await configureAuthenticationPolicy(
      electionId,
      {
        method,
        isEnabled: true,
        reason: "통합 편집 마법사 투표 참여 인증 방식 수정"
      },
      context
    );
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath(`/admin/elections/${electionId}`);
  revalidatePath(`/admin/elections/${electionId}/edit`);
  revalidatePath(`/admin/elections/${electionId}/auth-policy`);
  return {
    ok: true,
    message: "투표 참여 인증 방식을 저장했습니다. 모든 항목이 준비되면 상세 화면에서 검수 요청을 진행할 수 있습니다."
  };
}

export async function updateElectionQuestionsAndOptionsAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  if (!electionId) {
    return { ok: false, message: "수정할 투표를 찾을 수 없습니다." };
  }

  try {
    const context = await serviceContext();
    const detail = await getAdminElectionDetail(getPrismaClient(), context.session, electionId);
    if (!detail) {
      return { ok: false, message: "투표 정보를 찾을 수 없습니다." };
    }
    if (detail.state !== ElectionState.DRAFT) {
      return {
        ok: false,
        message: "초안 상태의 투표만 문항과 선택 항목을 수정할 수 있습니다."
      };
    }
    if (detail.startsAt <= new Date()) {
      return {
        ok: false,
        message: "시작일시가 지난 투표는 문항과 선택 항목을 수정할 수 없습니다."
      };
    }

    const submittedQuestionIds = rawValues(formData, "questionId");
    const activeQuestionIds = new Set(detail.questions.map((question) => question.id));
    if (
      submittedQuestionIds.length !== detail.questions.length ||
      submittedQuestionIds.some((questionId) => !activeQuestionIds.has(questionId))
    ) {
      return { ok: false, message: "문항 구성을 확인해 주세요." };
    }

    for (const question of detail.questions) {
      const questionTitle = value(formData, `questionTitle:${question.id}`);
      const questionDescription = value(formData, `questionDescription:${question.id}`);
      if (!questionTitle) {
        return { ok: false, message: "질문 제목을 입력해 주세요." };
      }

      const submittedOptionIds = rawValues(formData, `optionId:${question.id}`);
      const existingOptionIds = new Set(question.options.map((option) => option.id));
      if (
        submittedOptionIds.length !== question.options.length ||
        submittedOptionIds.some((optionId) => !existingOptionIds.has(optionId))
      ) {
        return { ok: false, message: "선택 항목 구성을 확인해 주세요." };
      }

      const newOptionLabels = rawValues(formData, `newOptionLabel:${question.id}`);
      const newOptionDescriptions = rawValues(formData, `newOptionDescription:${question.id}`);
      const appendedOptions = newOptionLabels
        .map((label, index) => ({
          label,
          description: newOptionDescriptions[index] || undefined
        }))
        .filter((option) => option.label.length > 0);

      if (
        newOptionLabels.some((label, index) => !label && (newOptionDescriptions[index] ?? "").length > 0)
      ) {
        return { ok: false, message: "새 선택 항목의 제목을 입력해 주세요." };
      }

      const existingLabels = question.options.map((option) => value(formData, `optionLabel:${option.id}`));
      if (existingLabels.some((label) => !label)) {
        return { ok: false, message: "기존 선택 항목 제목을 입력해 주세요." };
      }

      const finalLabels = [...existingLabels, ...appendedOptions.map((option) => option.label)];
      if (question.questionType !== "free_text" && finalLabels.length < 2) {
        return { ok: false, message: "선택 항목은 최소 2개 이상 유지해야 합니다." };
      }
      if (new Set(finalLabels.map((label) => label.toLowerCase())).size !== finalLabels.length) {
        return { ok: false, message: "선택 항목 제목이 중복되지 않도록 입력해 주세요." };
      }

      await updateQuestion(
        electionId,
        question.id,
        {
          title: questionTitle,
          description: questionDescription,
          reason: "통합 편집 마법사 문항 문구 수정"
        },
        context
      );

      for (const option of question.options) {
        await updateOption(
          electionId,
          question.id,
          option.id,
          {
            label: value(formData, `optionLabel:${option.id}`),
            description: value(formData, `optionDescription:${option.id}`),
            reason: "통합 편집 마법사 선택 항목 문구 수정"
          },
          context
        );
      }

      const nextDisplayOrder =
        question.options.length === 0
          ? 0
          : Math.max(...question.options.map((option) => option.displayOrder)) + 1;
      for (const [index, option] of appendedOptions.entries()) {
        await createOption(
          electionId,
          question.id,
          {
            label: option.label,
            description: option.description,
            displayOrder: nextDisplayOrder + index
          },
          context
        );
      }
    }
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath(`/admin/elections/${electionId}`);
  revalidatePath(`/admin/elections/${electionId}/edit`);
  revalidatePath(`/admin/elections/${electionId}/questions`);
  return {
    ok: true,
    message: "문항/선택 항목이 저장되었습니다. 투표를 시작하기 전에 상세 화면에서 제목, 일정, 문항, 선택 항목, 선거인 명부를 다시 확인해 주세요."
  };
}

function values(formData: FormData, key: string): string[] {
  return nonEmptyValues(formData, key);
}

function validateWizardInput(formData: FormData): string | null {
  const requiredFields = [
    ["title", "투표 제목"],
    ["electionType", "투표 유형"],
    ["startsAt", "시작일시"],
    ["endsAt", "종료일시"],
  ] as const;
  for (const [key, label] of requiredFields) {
    if (!value(formData, key)) {
      return `${label}을 입력해 주세요.`;
    }
  }

  const startsAt = new Date(value(formData, "startsAt"));
  const endsAt = new Date(value(formData, "endsAt"));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "시작일시와 종료일시를 확인해 주세요.";
  }
  if (endsAt <= startsAt) {
    return "종료일시는 시작일시보다 뒤여야 합니다.";
  }

  const optionTitles = values(formData, "optionTitle");
  if (optionTitles.length < 2) {
    return "선택 항목은 최소 2개 이상 입력해 주세요.";
  }
  if (new Set(optionTitles.map((title) => title.toLowerCase())).size !== optionTitles.length) {
    return "선택 항목 제목이 중복되지 않도록 입력해 주세요.";
  }

  if (value(formData, "registryMode") === "existing") {
    if (!value(formData, "managedRegistryId")) {
      return "연결할 선거인 명부를 선택해 주세요.";
    }
  } else {
    const voterRows = parseVoterRows(value(formData, "voterRows"));
    if (voterRows.length === 0) {
      return "선거인 명부를 1명 이상 입력해 주세요.";
    }
    const invalidRow = voterRows.find((row) => !validateVoterRegistryFields(row).ok);
    if (invalidRow) {
      return `선거인 명부 ${invalidRow.rowNumber}행의 호수번호, 이름, 식별번호, 생년월일을 확인해 주세요.`;
    }
    const voterIdentifiers = voterRows.map((row) => {
      const validated = validateVoterRegistryFields(row);
      return validated.fields ? canonicalVoterIdentifier(validated.fields).toLowerCase() : "";
    });
    if (new Set(voterIdentifiers).size !== voterIdentifiers.length) {
      return "선거인 명부에 중복된 선거인 정보가 있습니다.";
    }
  }

  return null;
}

function missingWizardPermissions(permissions: readonly string[]): string[] {
  const required = ["election.create", "question.write", "voter_registry.import"];
  return required.filter((permission) => !permissions.includes(permission));
}

export async function createElectionWizardAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const validationMessage = validateWizardInput(formData);
  if (validationMessage) {
    return { ok: false, message: validationMessage };
  }

  let electionId: string | undefined;
  try {
    const context = await serviceContext();
    const missingPermissions = missingWizardPermissions(context.session.permissions);
    if (missingPermissions.length > 0) {
      return {
        ok: false,
        message: "투표 생성, 문항 작성, 선거인 명부 등록 권한이 모두 필요합니다."
      };
    }

    const result = await createElectionDraft(
      {
        title: value(formData, "title"),
        description: optionalValue(formData, "description"),
        electionType: value(formData, "electionType") || "representative_election",
        votingMode: "anonymous",
        startsAt: value(formData, "startsAt"),
        endsAt: value(formData, "endsAt"),
        timezone: "Asia/Seoul"
      },
      context
    );
    electionId = result.election.id;

    const question = await createQuestion(
      electionId,
      {
        title: value(formData, "title"),
        description: optionalValue(formData, "description"),
        questionType: "single_choice",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        displayOrder: 0
      },
      context
    );

    const optionTitles = values(formData, "optionTitle");
    const optionDescriptions = formData.getAll("optionDescription").map((entry) => String(entry ?? "").trim());
    for (const [index, label] of optionTitles.entries()) {
      await createOption(
        electionId,
        question.id,
        {
          label,
          description: optionDescriptions[index] || undefined,
          displayOrder: index
        },
        context
      );
    }

    if (value(formData, "registryMode") === "existing") {
      const linkResult = await linkManagedRegistryToElection({
        prisma: getPrismaClient(),
        session: context.session,
        electionId,
        registryId: value(formData, "managedRegistryId")
      });
      if (!linkResult.ok) {
        return { ok: false, message: linkResult.message };
      }
    } else {
      await importEligibleVoters(
        electionId,
        {
          sourceType: "manual",
          rows: parseVoterRows(value(formData, "voterRows")),
          reason: "투표 생성 마법사 선거인 명부 등록"
        },
        context
      );
    }
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/elections");
  revalidatePath(`/admin/elections/${electionId}`);
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

function parseVoterRows(raw: string): Array<Partial<VoterRegistryFields> & { rowNumber: number }> {
  return parseVoterRegistryTextRows(raw);
}

export async function importVoterRegistryAction(
  _previous: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const electionId = value(formData, "electionId");
  const rows = parseVoterRows(value(formData, "rows"));
  if (rows.length === 0) {
    return { ok: false, message: "선거인 명부를 1명 이상 입력해 주세요." };
  }
  const invalidRow = rows.find((row) => !validateVoterRegistryFields(row).ok);
  if (invalidRow) {
    return {
      ok: false,
      message: `선거인 명부 ${invalidRow.rowNumber}행의 호수번호, 이름, 식별번호, 생년월일을 확인해 주세요.`
    };
  }
  const identifiers = rows.map((row) => {
    const validated = validateVoterRegistryFields(row);
    return validated.fields ? canonicalVoterIdentifier(validated.fields).toLowerCase() : "";
  });
  if (new Set(identifiers).size !== identifiers.length) {
    return { ok: false, message: "선거인 명부에 중복된 선거인 정보가 있습니다." };
  }
  try {
    const result = await importEligibleVoters(
      electionId,
      {
        sourceType: "manual",
        rows,
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
