import { parseEnv } from "../../lib/env";
import { decodeVoterRegistryPayload } from "../../lib/voter-registry-fields";
import type { ElectionStateValue } from "../../domain/elections/state-machine";
import type { AdminSession } from "../auth/admin-session";
import type { PrismaClientLike } from "../db/prisma";
import { decryptPersonalValue } from "../privacy/personal-data-encryption";
import { requirePermission } from "../rbac/authorize";

export type ManagedVoterRegistrySummary = Readonly<{
  id: string;
  title: string;
  description?: string | null;
  totalRows: number;
  validRows: number;
  useBirthDateForVerification: boolean;
  used: boolean;
  editable: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ManagedVoterRow = Readonly<{
  id: string;
  householdNumber: string;
  name: string;
  identifierLast4: string;
  birthDate6: string;
  status: string;
  createdAt: Date;
}>;

export type ManagedVoterRegistryUsedElection = Readonly<{
  id: string;
  title: string;
  state: ElectionStateValue;
  startsAt: Date;
  endsAt: Date;
  linkedAt: Date;
}>;

export type ManagedVoterRegistryDetail = ManagedVoterRegistrySummary & Readonly<{
  voters: readonly ManagedVoterRow[];
  usedElections: readonly ManagedVoterRegistryUsedElection[];
}>;

function organizationScope(session: AdminSession): string {
  requirePermission(session, "voter_registry.read");
  if (!session.organizationId) {
    throw new Error("admin session missing organization scope");
  }
  return session.organizationId;
}

function electionHasStarted(election: { state: string; startsAt: Date }, now = new Date()): boolean {
  return [
    "open",
    "paused",
    "closed",
    "tallying",
    "pending_confirmation",
    "confirmed",
    "published",
    "invalidated"
  ].includes(election.state) || election.startsAt <= now;
}

function isUsed(registry: {
  electionRegistries?: readonly { election: { state: string; startsAt: Date } }[];
}): boolean {
  return Boolean(registry.electionRegistries?.some((entry) => electionHasStarted(entry.election)));
}

function displayVoter(row: {
  id: string;
  nameEncrypted: string | null;
  phoneEncrypted: string | null;
  externalIdentifierEncrypted: string | null;
  status: string;
  createdAt: Date;
}): ManagedVoterRow {
  const env = parseEnv();
  const payload = decodeVoterRegistryPayload(
    decryptPersonalValue(row.externalIdentifierEncrypted, env.ENCRYPTION_KEY)
  );
  return Object.freeze({
    id: row.id,
    householdNumber: payload?.householdNumber ?? "기존 형식",
    name: payload?.name ?? decryptPersonalValue(row.nameEncrypted, env.ENCRYPTION_KEY) ?? "표시 제한",
    identifierLast4: payload?.identifierLast4 ?? decryptPersonalValue(row.phoneEncrypted, env.ENCRYPTION_KEY) ?? "표시 제한",
    birthDate6: payload?.birthDate6 ?? "기존 형식",
    status: row.status,
    createdAt: row.createdAt
  });
}

export async function listManagedVoterRegistrySummaries(
  prisma: PrismaClientLike,
  session: AdminSession
): Promise<ManagedVoterRegistrySummary[]> {
  const organizationId = organizationScope(session);
  const registries = await prisma.managedVoterRegistry.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      electionRegistries: {
        where: { election: { deletedAt: null } },
        select: {
          election: {
            select: {
              state: true,
              startsAt: true
            }
          }
        }
      },
      _count: {
        select: { electionRegistries: true }
      }
    }
  });

  return registries.map((registry) => {
    const used = isUsed(registry);
    return Object.freeze({
      id: registry.id,
      title: registry.title,
      description: registry.description,
      totalRows: registry.totalRows,
      validRows: registry.validRows,
      useBirthDateForVerification: registry.useBirthDateForVerification,
      used,
      editable: !used,
      createdAt: registry.createdAt,
      updatedAt: registry.updatedAt
    });
  });
}

export async function getManagedVoterRegistryDetail(
  prisma: PrismaClientLike,
  session: AdminSession,
  registryId: string
): Promise<ManagedVoterRegistryDetail | null> {
  const organizationId = organizationScope(session);
  const registry = await prisma.managedVoterRegistry.findFirst({
    where: { id: registryId, organizationId },
    include: {
      voters: {
        orderBy: { createdAt: "asc" }
      },
      electionRegistries: {
        where: { election: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          election: {
            select: {
              id: true,
              title: true,
              state: true,
              startsAt: true,
              endsAt: true
            }
          }
        }
      },
      _count: {
        select: { electionRegistries: true }
      }
    }
  });
  if (!registry) return null;
  const used = isUsed(registry);
  return Object.freeze({
    id: registry.id,
    title: registry.title,
    description: registry.description,
    totalRows: registry.totalRows,
    validRows: registry.validRows,
    useBirthDateForVerification: registry.useBirthDateForVerification,
    used,
    editable: !used,
    createdAt: registry.createdAt,
    updatedAt: registry.updatedAt,
    voters: registry.voters.map(displayVoter),
    usedElections: registry.electionRegistries.map((entry) => ({
      id: entry.election.id,
      title: entry.election.title,
      state: entry.election.state as ElectionStateValue,
      startsAt: entry.election.startsAt,
      endsAt: entry.election.endsAt,
      linkedAt: entry.createdAt
    }))
  });
}
