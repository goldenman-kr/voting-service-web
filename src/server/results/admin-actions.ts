"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdminSessionFromCookies } from "../auth/current-admin";
import { getPrismaClient } from "../db/prisma";
import { normalizeApiError } from "../http/errors";
import { createPrismaResultRepository } from "./prisma-repository";
import {
  confirmResult,
  getElectionResult,
  invalidateElectionResult,
  publishResult,
  requestCorrection,
  tallyElectionResult,
  type ResultServiceContext
} from "./result-service";

export type ResultActionState = Readonly<{
  ok: boolean;
  message?: string;
}>;

async function resultContext(): Promise<ResultServiceContext> {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) {
    throw new Error("missing admin session");
  }
  return {
    session: restored.session,
    repository: createPrismaResultRepository(getPrismaClient())
  };
}

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function safeMessage(error: unknown): string {
  return normalizeApiError(error).userMessage;
}

type ResultOperation =
  | "tally"
  | "confirm"
  | "publish"
  | "request_correction"
  | "invalidate";

const resultOperationMessages: Record<ResultOperation, string> = {
  tally: "결과 집계를 실행했습니다.",
  confirm: "결과를 확정했습니다.",
  publish: "결과를 공개했습니다.",
  request_correction: "정정 요청을 접수했습니다.",
  invalidate: "무효 처리 기록을 남겼습니다."
};

export async function resultOperationAction(
  _previous: ResultActionState,
  formData: FormData
): Promise<ResultActionState> {
  const electionId = value(formData, "electionId");
  const operation = value(formData, "operation") as ResultOperation;
  const reason = value(formData, "reason");
  const notice = value(formData, "notice");
  try {
    const context = await resultContext();
    switch (operation) {
      case "tally":
        await tallyElectionResult(electionId, { reason }, context);
        break;
      case "confirm":
        await confirmResult(electionId, { reason }, context);
        break;
      case "publish":
        await publishResult(electionId, { reason, notice }, context);
        break;
      case "request_correction":
        await requestCorrection(electionId, { reason, notice }, context);
        break;
      case "invalidate":
        await invalidateElectionResult(electionId, { reason, notice }, context);
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
  revalidatePath(`/admin/elections/${electionId}/results`);
  return { ok: true, message: resultOperationMessages[operation] };
}

export async function getAdminResultView(electionId: string) {
  try {
    const context = await resultContext();
    return { data: await getElectionResult(electionId, context) };
  } catch (error) {
    return { error: safeMessage(error) };
  }
}
