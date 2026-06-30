import { createHmac } from "node:crypto";

import {
  canonicalVoterIdentifier,
  decodeVoterRegistryPayload,
  encodedVoterRegistryPayload,
  parseVoterRegistryTextRows,
  validateVoterRegistryFields,
  type VoterRegistryFields
} from "../../lib/voter-registry-fields";
import type { AdminSession } from "../auth/admin-session";
import type { PrismaClientLike } from "../db/prisma";
import { encryptPersonalValue } from "../privacy/personal-data-encryption";
import { requirePermission } from "../rbac/authorize";

export type RegistryActionResult = Readonly<{
  ok: boolean;
  message?: string;
  registryId?: string;
}>;

function organizationIdFor(session: AdminSession): string {
  if (!session.organizationId) {
    throw new Error("admin session missing organization scope");
  }
  return session.organizationId;
}

function hmacValue(value: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(value.trim().toLowerCase()).digest("hex");
}

function protectedPayload(fields: VoterRegistryFields, encryptionKey: string): {
  nameEncrypted?: string;
  phoneEncrypted?: string;
  externalIdentifierEncrypted?: string;
} {
  return {
    nameEncrypted: encryptPersonalValue(fields.name, encryptionKey),
    phoneEncrypted: encryptPersonalValue(fields.identifierLast4, encryptionKey),
    externalIdentifierEncrypted: encryptPersonalValue(encodedVoterRegistryPayload(fields), encryptionKey)
  };
}

export function parseValidatedRows(raw: string): {
  ok: boolean;
  fields: VoterRegistryFields[];
  message?: string;
} {
  const rows = parseVoterRegistryTextRows(raw);
  if (rows.length === 0) {
    return { ok: false, fields: [], message: "선거인 명부를 1명 이상 입력해 주세요." };
  }
  const fields: VoterRegistryFields[] = [];
  for (const row of rows) {
    const validation = validateVoterRegistryFields(row);
    if (!validation.ok || !validation.fields) {
      return {
        ok: false,
        fields: [],
        message: `선거인 명부 ${row.rowNumber}행의 호수번호, 이름, 식별번호, 생년월일을 확인해 주세요.`
      };
    }
    fields.push(validation.fields);
  }
  const identifiers = fields.map((field) => canonicalVoterIdentifier(field).toLowerCase());
  if (new Set(identifiers).size !== identifiers.length) {
    return { ok: false, fields: [], message: "선거인 명부에 중복된 선거인 정보가 있습니다." };
  }
  return { ok: true, fields };
}

async function assertEditableRegistry(
  prisma: PrismaClientLike,
  session: AdminSession,
  registryId: string
) {
  requirePermission(session, "voter_registry.import");
  const organizationId = organizationIdFor(session);
  const registry = await prisma.managedVoterRegistry.findFirst({
    where: { id: registryId, organizationId },
    include: { _count: { select: { electionRegistries: true } } }
  });
  if (!registry) {
    return { ok: false as const, message: "명부를 찾을 수 없습니다." };
  }
  if (registry.lockedAt || registry._count.electionRegistries > 0) {
    return { ok: false as const, message: "이미 투표에 사용된 명부는 수정할 수 없습니다." };
  }
  return { ok: true as const, registry };
}

async function refreshCounts(prisma: PrismaClientLike, registryId: string): Promise<void> {
  const [totalRows, validRows] = await Promise.all([
    prisma.managedVoter.count({ where: { managedRegistryId: registryId } }),
    prisma.managedVoter.count({ where: { managedRegistryId: registryId, status: "active" } })
  ]);
  await prisma.managedVoterRegistry.update({
    where: { id: registryId },
    data: {
      totalRows,
      validRows,
      status: validRows > 0 ? "validated" : "draft"
    }
  });
}

export async function createManagedRegistry({
  prisma,
  session,
  title,
  description,
  rows,
  hmacKey,
  encryptionKey
}: {
  prisma: PrismaClientLike;
  session: AdminSession;
  title: string;
  description?: string;
  rows: string;
  hmacKey: string;
  encryptionKey: string;
}): Promise<RegistryActionResult> {
  requirePermission(session, "voter_registry.import");
  const organizationId = organizationIdFor(session);
  if (!title.trim()) {
    return { ok: false, message: "명부 제목을 입력해 주세요." };
  }
  const parsed = parseValidatedRows(rows);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }
  const registry = await prisma.managedVoterRegistry.create({
    data: {
      organizationId,
      title: title.trim(),
      description: description?.trim() || undefined,
      status: "validated",
      sourceType: "manual",
      totalRows: parsed.fields.length,
      validRows: parsed.fields.length,
      voters: {
        create: parsed.fields.map((fields) => ({
          ...protectedPayload(fields, encryptionKey || hmacKey),
          externalIdentifierHmac: hmacValue(canonicalVoterIdentifier(fields), hmacKey),
          status: "active"
        }))
      }
    }
  });
  return { ok: true, registryId: registry.id, message: "새 명부를 만들었습니다." };
}

export async function addManagedVoter({
  prisma,
  session,
  registryId,
  fields,
  hmacKey,
  encryptionKey
}: {
  prisma: PrismaClientLike;
  session: AdminSession;
  registryId: string;
  fields: Partial<VoterRegistryFields>;
  hmacKey: string;
  encryptionKey: string;
}): Promise<RegistryActionResult> {
  const editable = await assertEditableRegistry(prisma, session, registryId);
  if (!editable.ok) return editable;
  const validation = validateVoterRegistryFields(fields);
  if (!validation.ok || !validation.fields) {
    return { ok: false, message: "호수번호, 이름, 식별번호, 생년월일을 확인해 주세요." };
  }
  const externalIdentifierHmac = hmacValue(canonicalVoterIdentifier(validation.fields), hmacKey);
  const duplicate = await prisma.managedVoter.findFirst({
    where: { managedRegistryId: registryId, externalIdentifierHmac }
  });
  if (duplicate) {
    return { ok: false, message: "중복된 선거인 정보가 있습니다." };
  }
  await prisma.managedVoter.create({
    data: {
      managedRegistryId: registryId,
      ...protectedPayload(validation.fields, encryptionKey || hmacKey),
      externalIdentifierHmac,
      status: "active"
    }
  });
  await refreshCounts(prisma, registryId);
  return { ok: true, message: "선거인을 추가했습니다." };
}

export async function updateManagedVoter({
  prisma,
  session,
  registryId,
  voterId,
  fields,
  hmacKey,
  encryptionKey
}: {
  prisma: PrismaClientLike;
  session: AdminSession;
  registryId: string;
  voterId: string;
  fields: Partial<VoterRegistryFields>;
  hmacKey: string;
  encryptionKey: string;
}): Promise<RegistryActionResult> {
  const editable = await assertEditableRegistry(prisma, session, registryId);
  if (!editable.ok) return editable;
  const validation = validateVoterRegistryFields(fields);
  if (!validation.ok || !validation.fields) {
    return { ok: false, message: "호수번호, 이름, 식별번호, 생년월일을 확인해 주세요." };
  }
  const existing = await prisma.managedVoter.findFirst({
    where: { id: voterId, managedRegistryId: registryId }
  });
  if (!existing) {
    return { ok: false, message: "선거인을 찾을 수 없습니다." };
  }
  const externalIdentifierHmac = hmacValue(canonicalVoterIdentifier(validation.fields), hmacKey);
  const duplicate = await prisma.managedVoter.findFirst({
    where: { managedRegistryId: registryId, externalIdentifierHmac, NOT: { id: voterId } }
  });
  if (duplicate) {
    return { ok: false, message: "중복된 선거인 정보가 있습니다." };
  }
  await prisma.managedVoter.update({
    where: { id: voterId },
    data: {
      ...protectedPayload(validation.fields, encryptionKey || hmacKey),
      externalIdentifierHmac,
      status: "active"
    }
  });
  await refreshCounts(prisma, registryId);
  return { ok: true, message: "선거인 정보를 수정했습니다." };
}

export async function deleteManagedVoter({
  prisma,
  session,
  registryId,
  voterId
}: {
  prisma: PrismaClientLike;
  session: AdminSession;
  registryId: string;
  voterId: string;
}): Promise<RegistryActionResult> {
  const editable = await assertEditableRegistry(prisma, session, registryId);
  if (!editable.ok) return editable;
  const voter = await prisma.managedVoter.findFirst({
    where: { id: voterId, managedRegistryId: registryId }
  });
  if (!voter) {
    return { ok: false, message: "선거인을 찾을 수 없습니다." };
  }
  await prisma.managedVoter.update({
    where: { id: voterId },
    data: { status: "disabled" }
  });
  await refreshCounts(prisma, registryId);
  return { ok: true, message: "선거인을 명부에서 제외했습니다." };
}

export async function cloneManagedRegistry({
  prisma,
  session,
  registryId
}: {
  prisma: PrismaClientLike;
  session: AdminSession;
  registryId: string;
}): Promise<RegistryActionResult> {
  requirePermission(session, "voter_registry.import");
  const organizationId = organizationIdFor(session);
  const source = await prisma.managedVoterRegistry.findFirst({
    where: { id: registryId, organizationId },
    include: { voters: { where: { status: "active" } } }
  });
  if (!source) {
    return { ok: false, message: "복제할 명부를 찾을 수 없습니다." };
  }
  const clone = await prisma.managedVoterRegistry.create({
    data: {
      organizationId,
      title: `${source.title} (사본)`,
      description: source.description,
      status: source.voters.length > 0 ? "validated" : "draft",
      sourceType: "clone",
      totalRows: source.voters.length,
      validRows: source.voters.length,
      voters: {
        create: source.voters.map((voter) => ({
          nameEncrypted: voter.nameEncrypted,
          phoneEncrypted: voter.phoneEncrypted,
          externalIdentifierEncrypted: voter.externalIdentifierEncrypted,
          externalIdentifierHmac: voter.externalIdentifierHmac,
          status: "active"
        }))
      }
    }
  });
  return { ok: true, registryId: clone.id, message: "명부를 복제했습니다." };
}

export async function linkManagedRegistryToElection({
  prisma,
  session,
  electionId,
  registryId
}: {
  prisma: PrismaClientLike;
  session: AdminSession;
  electionId: string;
  registryId: string;
}): Promise<RegistryActionResult> {
  requirePermission(session, "voter_registry.import");
  const organizationId = organizationIdFor(session);
  const [election, source] = await Promise.all([
    prisma.election.findFirst({ where: { id: electionId, organizationId }, select: { id: true } }),
    prisma.managedVoterRegistry.findFirst({
      where: { id: registryId, organizationId },
      include: { voters: { where: { status: "active" } } }
    })
  ]);
  if (!election || !source) {
    return { ok: false, message: "투표와 명부 정보를 확인해 주세요." };
  }
  if (source.voters.length === 0) {
    return { ok: false, message: "연결할 선거인이 1명 이상 필요합니다." };
  }
  await prisma.$transaction(async (tx) => {
    const registry = await tx.voterRegistry.upsert({
      where: { electionId },
      create: {
        electionId,
        managedRegistryId: registryId,
        status: "locked",
        sourceType: "managed",
        totalRows: source.voters.length,
        validRows: source.voters.length,
        confirmedAt: new Date()
      },
      update: {
        managedRegistryId: registryId,
        status: "locked",
        sourceType: "managed",
        totalRows: source.voters.length,
        validRows: source.voters.length,
        confirmedAt: new Date()
      }
    });
    await tx.eligibleVoter.deleteMany({ where: { electionId, invitations: { none: {} }, votingCredentials: { none: {} } } });
    await tx.eligibleVoter.createMany({
      data: source.voters.map((voter) => ({
        electionId,
        voterRegistryId: registry.id,
        nameEncrypted: voter.nameEncrypted,
        phoneEncrypted: voter.phoneEncrypted,
        externalIdentifierEncrypted: voter.externalIdentifierEncrypted,
        externalIdentifierHmac: voter.externalIdentifierHmac,
        status: "active"
      })),
      skipDuplicates: true
    });
    await tx.managedVoterRegistry.update({
      where: { id: registryId },
      data: { lockedAt: source.lockedAt ?? new Date(), status: "locked" }
    });
  });
  return { ok: true, message: "선거인 명부를 투표에 연결했습니다." };
}

export function voterFieldsFromForm(formData: FormData): Partial<VoterRegistryFields> {
  return {
    householdNumber: String(formData.get("householdNumber") ?? ""),
    name: String(formData.get("name") ?? ""),
    identifierLast4: String(formData.get("identifierLast4") ?? ""),
    birthDate6: String(formData.get("birthDate6") ?? "")
  };
}

export function decodeManagedVoterPayload(raw: string | undefined | null): VoterRegistryFields | null {
  return decodeVoterRegistryPayload(raw);
}
