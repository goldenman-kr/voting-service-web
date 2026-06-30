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
    invitationSummary: {
      total: number;
      pending: number;
      sent: number;
      failed: number;
      opened: number;
      expired: number;
      revoked: number;
    };
    resultSummary: {
      latestResultStatus?: string | null;
      publishedVersionCount: number;
    };
    questions: readonly {
      id: string;
      title: string;
      description?: string | null;
      questionType: string;
      displayOrder: number;
      options: readonly {
        id: string;
        label: string;
        description?: string | null;
        displayOrder: number;
      }[];
    }[];
  }>;

export type AdminElectionDashboard = Readonly<{
  totalCount: number;
  preStartCount: number;
  activeCount: number;
  completedCount: number;
  registryCount: number;
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
  const organizationId = assertAdminElectionRead(session);
  const elections = await listAdminElectionItems(prisma, session);
  const registryCount = await prisma.voterRegistry.count({
    where: { election: { organizationId } }
  });
  const byState = Object.fromEntries(
    [
      ElectionState.DRAFT,
      ElectionState.READY_FOR_REVIEW,
      ElectionState.APPROVED,
      ElectionState.SCHEDULED,
      ElectionState.NOTICE,
      ElectionState.OPEN,
      ElectionState.PAUSED,
      ElectionState.CLOSED,
      ElectionState.TALLYING,
      ElectionState.PENDING_CONFIRMATION,
      ElectionState.CONFIRMED,
      ElectionState.PUBLISHED
    ].map((state) => [state, elections.filter((election) => election.state === state).length])
  );
  const preStartStates = new Set<ElectionStateValue>([
    ElectionState.DRAFT,
    ElectionState.READY_FOR_REVIEW,
    ElectionState.APPROVED,
    ElectionState.SCHEDULED,
    ElectionState.NOTICE
  ]);
  const completedStates = new Set<ElectionStateValue>([
    ElectionState.CLOSED,
    ElectionState.TALLYING,
    ElectionState.PENDING_CONFIRMATION,
    ElectionState.CONFIRMED,
    ElectionState.PUBLISHED
  ]);

  return Object.freeze({
    totalCount: elections.length,
    preStartCount: elections.filter((election) => preStartStates.has(election.state)).length,
    activeCount: elections.filter((election) => election.state === ElectionState.OPEN || election.state === ElectionState.PAUSED).length,
    completedCount: elections.filter((election) => completedStates.has(election.state)).length,
    registryCount,
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
  const [invitationGroups, latestResult, publishedVersionCount] = await Promise.all([
    prisma.invitation.groupBy({
      by: ["status"],
      where: { electionId },
      _count: { _all: true }
    }),
    prisma.result.findFirst({
      where: { electionId },
      orderBy: { createdAt: "desc" },
      select: { status: true }
    }),
    prisma.resultVersion.count({
      where: { electionId, status: "published" }
    })
  ]);
  const invitationSummary = {
    total: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    opened: 0,
    expired: 0,
    revoked: 0
  };
  for (const group of invitationGroups) {
    const count = group._count._all;
    invitationSummary.total += count;
    if (group.status in invitationSummary) {
      invitationSummary[group.status as keyof typeof invitationSummary] += count;
    }
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
    invitationSummary,
    resultSummary: {
      latestResultStatus: latestResult?.status ?? null,
      publishedVersionCount
    },
    questions: election.questions.map((question) => ({
      id: question.id,
      title: question.title,
      description: question.description,
      questionType: question.questionType,
      displayOrder: question.displayOrder,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        displayOrder: option.displayOrder
      }))
    }))
  });
}
