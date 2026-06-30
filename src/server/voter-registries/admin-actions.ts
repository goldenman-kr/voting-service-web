"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseEnv } from "../../lib/env";
import { getCurrentAdminSessionFromCookies } from "../auth/current-admin";
import { getPrismaClient } from "../db/prisma";
import { normalizeApiError } from "../http/errors";
import {
  addManagedVoter,
  cloneManagedRegistry,
  createManagedRegistry,
  deleteManagedVoter,
  updateManagedRegistryTitle,
  updateManagedVoter,
  voterFieldsFromForm
} from "./managed-registry-service";

export type VoterRegistryActionState = Readonly<{
  ok: boolean;
  message?: string;
}>;

const initialFailure: VoterRegistryActionState = { ok: false };

async function context() {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) {
    throw new Error("missing admin session");
  }
  const env = parseEnv();
  return {
    session: restored.session,
    prisma: getPrismaClient(),
    hmacKey: env.HMAC_KEY,
    encryptionKey: env.ENCRYPTION_KEY
  };
}

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function safeMessage(error: unknown): string {
  return normalizeApiError(error).userMessage;
}

export async function createManagedRegistryAction(
  _previous: VoterRegistryActionState = initialFailure,
  formData: FormData
): Promise<VoterRegistryActionState> {
  let registryId: string | undefined;
  try {
    const current = await context();
    const result = await createManagedRegistry({
      prisma: current.prisma,
      session: current.session,
      title: value(formData, "title"),
      description: value(formData, "description"),
      rows: value(formData, "rows"),
      hmacKey: current.hmacKey,
      encryptionKey: current.encryptionKey
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    registryId = result.registryId;
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }

  revalidatePath("/admin/voter-registries");
  redirect(`/admin/voter-registries/${registryId}`);
}

export async function addManagedVoterAction(
  _previous: VoterRegistryActionState = initialFailure,
  formData: FormData
): Promise<VoterRegistryActionState> {
  const registryId = value(formData, "registryId");
  try {
    const current = await context();
    const result = await addManagedVoter({
      prisma: current.prisma,
      session: current.session,
      registryId,
      fields: voterFieldsFromForm(formData),
      hmacKey: current.hmacKey,
      encryptionKey: current.encryptionKey
    });
    revalidatePath(`/admin/voter-registries/${registryId}`);
    revalidatePath("/admin/voter-registries");
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function updateManagedRegistryTitleAction(
  _previous: VoterRegistryActionState = initialFailure,
  formData: FormData
): Promise<VoterRegistryActionState> {
  const registryId = value(formData, "registryId");
  try {
    const current = await context();
    const result = await updateManagedRegistryTitle({
      prisma: current.prisma,
      session: current.session,
      registryId,
      title: value(formData, "title")
    });
    revalidatePath(`/admin/voter-registries/${registryId}`);
    revalidatePath("/admin/voter-registries");
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function updateManagedVoterAction(
  _previous: VoterRegistryActionState = initialFailure,
  formData: FormData
): Promise<VoterRegistryActionState> {
  const registryId = value(formData, "registryId");
  try {
    const current = await context();
    const result = await updateManagedVoter({
      prisma: current.prisma,
      session: current.session,
      registryId,
      voterId: value(formData, "voterId"),
      fields: voterFieldsFromForm(formData),
      hmacKey: current.hmacKey,
      encryptionKey: current.encryptionKey
    });
    revalidatePath(`/admin/voter-registries/${registryId}`);
    revalidatePath("/admin/voter-registries");
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function deleteManagedVoterAction(formData: FormData): Promise<void> {
  const registryId = value(formData, "registryId");
  try {
    const current = await context();
    await deleteManagedVoter({
      prisma: current.prisma,
      session: current.session,
      registryId,
      voterId: value(formData, "voterId")
    });
  } catch {
    // Keep delete failures generic and avoid echoing row data in the UI.
  }
  revalidatePath(`/admin/voter-registries/${registryId}`);
  revalidatePath("/admin/voter-registries");
}

export async function cloneManagedRegistryAction(formData: FormData): Promise<void> {
  let registryId: string | undefined;
  try {
    const current = await context();
    const result = await cloneManagedRegistry({
      prisma: current.prisma,
      session: current.session,
      registryId: value(formData, "registryId")
    });
    registryId = result.registryId;
  } catch {
    registryId = undefined;
  }
  revalidatePath("/admin/voter-registries");
  if (registryId) {
    redirect(`/admin/voter-registries/${registryId}`);
  }
}
