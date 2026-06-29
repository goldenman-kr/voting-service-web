import { ElectionState } from "../../guardrails/index.js";
import type { ElectionStateValue } from "../../domain/elections/state-machine";
import type { AdminSession } from "../auth/admin-session";
import type { PrismaClientLike } from "../db/prisma";
import { requirePermission } from "../rbac/authorize";

export type AdminElectionListItem = Readonly<{
  id: string;
  title: string;
  description?: string | null;
  state: ElectionStateValue;
  electionType: string;
  votingMode: string;
  startsAt: Date;
  endsAt: Date;
  updatedAt: Date;
  questionCount: number;
  eligibleVoterCount: number;
}>;

export type AdminElectionDetail = AdminElectionListItem &
  Readonly<{
    authenticationPolicy?: {
      method: string;
      isEnabled: boolean;
      isPaidMethod: boolean;
      securityLevel: string;
      codeTtlMinutes?: number | null;
      maxCodeResends?: number | null;
    } | null;
    voterRegistry?: {
      status: string;
      totalRows: number;
      validRows: number;
    } | null;
    questions: readonly {
      id: string;
      title: string;
      questionType: string;
      displayOrder: number;
      options: readonly {
        id: string;
        label: string;
        displayOrder: number;
      }[];
    }[];
  }>;

export type AdminElectionDashboard = Readonly<{
  totalCount: number;
  byState: Readonly<Record<string, number>>;
  reviewWaiting: readonly AdminElectionListItem[];
  recent: readonly AdminElectionListItem[];
}>;

function assertAdminElectionRead(session: AdminSession): string {
  requirePermission(session, "election.read");
  if (!session.organizationId) {
    throw new Error("admin session missing organization scope");
  }
  return session.organizationId;
}

function mapListItem(record: {
  id: string;
  title: string;
  description: string | null;
  state: string;
  electionType: string;
  votingMode: string;
  startsAt: Date;
  endsAt: Date;
  updatedAt: Date;
  _count: { questions: number; eligibleVoters: number };
}): AdminElectionListItem {
  return Object.freeze({
    id: record.id,
    title: record.title,
    description: record.description,
    state: record.state as ElectionStateValue,
    electionType: record.electionType,
    votingMode: record.votingMode,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    updatedAt: record.updatedAt,
    questionCount: record._count.questions,
    eligibleVoterCount: record._count.eligibleVoters
  });
}

export async function listAdminElectionItems(
  prisma: PrismaClientLike,
  session: AdminSession
): Promise<AdminElectionListItem[]> {
  const organizationId = assertAdminElectionRead(session);
  const elections = await prisma.election.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { questions: true, eligibleVoters: true }
      }
    }
  });
  return elections.map(mapListItem);
}

export async function getAdminElectionDashboard(
  prisma: PrismaClientLike,
  session: AdminSession
): Promise<AdminElectionDashboard> {
  const elections = await listAdminElectionItems(prisma, session);
  const byState = Object.fromEntries(
    [
      ElectionState.DRAFT,
      ElectionState.READY_FOR_REVIEW,
      ElectionState.OPEN,
      ElectionState.CLOSED,
      ElectionState.PUBLISHED
    ].map((state) => [state, elections.filter((election) => election.state === state).length])
  );

  return Object.freeze({
    totalCount: elections.length,
    byState,
    reviewWaiting: elections.filter((election) => election.state === ElectionState.READY_FOR_REVIEW),
    recent: elections.slice(0, 10)
  });
}

export async function getAdminElectionDetail(
  prisma: PrismaClientLike,
  session: AdminSession,
  electionId: string
): Promise<AdminElectionDetail | null> {
  const organizationId = assertAdminElectionRead(session);
  const election = await prisma.election.findFirst({
    where: { id: electionId, organizationId },
    include: {
      authenticationPolicy: true,
      voterRegistry: true,
      questions: {
        where: { status: "active" },
        orderBy: { displayOrder: "asc" },
        include: {
          options: {
            where: { status: "active" },
            orderBy: { displayOrder: "asc" }
          }
        }
      },
      _count: {
        select: { questions: true, eligibleVoters: true }
      }
    }
  });
  if (!election) {
    return null;
  }

  return Object.freeze({
    ...mapListItem(election),
    authenticationPolicy: election.authenticationPolicy
      ? {
          method: election.authenticationPolicy.method,
          isEnabled: election.authenticationPolicy.isEnabled,
          isPaidMethod: election.authenticationPolicy.isPaidMethod,
          securityLevel: election.authenticationPolicy.securityLevel,
          codeTtlMinutes: election.authenticationPolicy.codeTtlMinutes,
          maxCodeResends: election.authenticationPolicy.maxCodeResends
        }
      : null,
    voterRegistry: election.voterRegistry
      ? {
          status: election.voterRegistry.status,
          totalRows: election.voterRegistry.totalRows,
          validRows: election.voterRegistry.validRows
        }
      : null,
    questions: election.questions.map((question) => ({
      id: question.id,
      title: question.title,
      questionType: question.questionType,
      displayOrder: question.displayOrder,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        displayOrder: option.displayOrder
      }))
    }))
  });
}
