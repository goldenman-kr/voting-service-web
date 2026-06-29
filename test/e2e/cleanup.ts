import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadEnvFile(".env");

const E2E_TENANT_PREFIX = "E2E Smoke Tenant e2e-";

export type E2eCleanupTarget = Readonly<{
  runId?: string;
  tenantId?: string;
}>;

export type E2eCleanupResult = Readonly<{
  tenantCount: number;
  organizationCount: number;
  electionCount: number;
  userCount: number;
  roleCount: number;
}>;

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is required for E2E cleanup");
  }
  return value;
}

function parseDatabaseUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL");
  }
}

export function assertSafeE2eCleanupTarget(target: E2eCleanupTarget = {}, dbUrl = databaseUrl()): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("E2E cleanup is disabled when NODE_ENV=production");
  }
  if (target.runId && !target.runId.startsWith("e2e-")) {
    throw new Error("E2E cleanup runId must start with e2e-");
  }
  const parsed = parseDatabaseUrl(dbUrl);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("E2E cleanup only supports PostgreSQL URLs");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error("E2E cleanup refuses non-local DATABASE_URL hosts");
  }
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!databaseName.includes("voting_service_web")) {
    throw new Error("E2E cleanup refuses unexpected database names");
  }
}

export function createCleanupPrisma() {
  const dbUrl = databaseUrl();
  assertSafeE2eCleanupTarget({}, dbUrl);
  return new PrismaClient({ adapter: new PrismaPg(dbUrl) });
}

export async function cleanupE2eData(
  prisma: PrismaClient,
  target: E2eCleanupTarget = {}
): Promise<E2eCleanupResult> {
  assertSafeE2eCleanupTarget(target);
  const tenantWhere = target.tenantId
    ? { id: target.tenantId }
    : target.runId
      ? { name: `${E2E_TENANT_PREFIX}${target.runId}` }
      : { name: { startsWith: E2E_TENANT_PREFIX } };

  const tenants = await prisma.tenant.findMany({
    where: tenantWhere,
    select: { id: true }
  });
  if (tenants.length === 0) {
    return {
      tenantCount: 0,
      organizationCount: 0,
      electionCount: 0,
      userCount: 0,
      roleCount: 0
    };
  }

  const tenantIds = tenants.map((tenant) => tenant.id);
  const [organizations, users] = await Promise.all([
    prisma.organization.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true }
    }),
    prisma.user.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true }
    })
  ]);
  const organizationIds = organizations.map((organization) => organization.id);
  const userIds = users.map((user) => user.id);
  const elections = await prisma.election.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { id: true }
  });
  const electionIds = elections.map((election) => election.id);
  const roles = await prisma.role.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { id: true }
  });
  const roleIds = roles.map((role) => role.id);

  await prisma.$transaction(async (tx) => {
    await tx.securityEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.auditEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.dbAccessEvent.deleteMany({ where: { actorUserId: { in: userIds } } });

    await tx.reportExport.deleteMany({
      where: {
        OR: [
          { report: { electionId: { in: electionIds } } },
          { requestedById: { in: userIds } },
          { approvedById: { in: userIds } }
        ]
      }
    });
    await tx.report.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.correctionRequest.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.invalidationRecord.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.dispute.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.operationIncident.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.deletionRequest.deleteMany({
      where: {
        OR: [
          { organizationId: { in: organizationIds } },
          { electionId: { in: electionIds } },
          { requestedById: { in: userIds } },
          { approvedById: { in: userIds } }
        ]
      }
    });

    await tx.resultVersion.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.resultItem.deleteMany({ where: { result: { electionId: { in: electionIds } } } });
    await tx.result.deleteMany({ where: { electionId: { in: electionIds } } });

    await tx.submissionEvent.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.anonymousBallotGroup.updateMany({
      where: { electionId: { in: electionIds } },
      data: { currentBallotId: null }
    });
    await tx.voteOption.deleteMany({ where: { vote: { ballot: { electionId: { in: electionIds } } } } });
    await tx.vote.deleteMany({ where: { ballot: { electionId: { in: electionIds } } } });
    await tx.ballot.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.anonymousBallotGroup.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.anonymousVotingPass.deleteMany({ where: { electionId: { in: electionIds } } });

    await tx.credentialEvent.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.voterSession.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.invitation.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.votingCredential.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.eligibleVoter.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.voterRegistryValidationError.deleteMany({
      where: { import: { registry: { electionId: { in: electionIds } } } }
    });
    await tx.voterRegistryImport.deleteMany({ where: { registry: { electionId: { in: electionIds } } } });
    await tx.voterRegistry.deleteMany({ where: { electionId: { in: electionIds } } });

    await tx.deliveryEvent.deleteMany({
      where: {
        OR: [
          { organizationId: { in: organizationIds } },
          { electionId: { in: electionIds } }
        ]
      }
    });
    await tx.electionChangeHistory.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.electionStateHistory.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.option.deleteMany({ where: { question: { electionId: { in: electionIds } } } });
    await tx.question.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.authenticationPolicy.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.electionPolicy.deleteMany({ where: { electionId: { in: electionIds } } });
    await tx.userRole.deleteMany({
      where: {
        OR: [
          { electionId: { in: electionIds } },
          { userId: { in: userIds } },
          { roleId: { in: roleIds } }
        ]
      }
    });
    await tx.election.deleteMany({ where: { id: { in: electionIds } } });

    await tx.adminStepUpGrant.deleteMany({ where: { userId: { in: userIds } } });
    await tx.adminSession.deleteMany({ where: { userId: { in: userIds } } });
    await tx.userMfaMethod.deleteMany({ where: { userId: { in: userIds } } });
    await tx.rolePermission.deleteMany({
      where: {
        OR: [
          { roleId: { in: roleIds } },
          { grantedById: { in: userIds } }
        ]
      }
    });
    await tx.role.deleteMany({ where: { id: { in: roleIds } } });
    await tx.organizationAuthenticationMethod.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await tx.notificationSetting.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await tx.retentionPolicy.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    await tx.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  });

  return {
    tenantCount: tenantIds.length,
    organizationCount: organizationIds.length,
    electionCount: electionIds.length,
    userCount: userIds.length,
    roleCount: roleIds.length
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.E2E_CLEANUP_CONFIRM !== "DELETE_E2E_DATA") {
    throw new Error("Set E2E_CLEANUP_CONFIRM=DELETE_E2E_DATA to run E2E cleanup");
  }
  const prisma = createCleanupPrisma();
  try {
    const result = await cleanupE2eData(prisma, {
      runId: process.env.E2E_CLEANUP_RUN_ID
    });
    console.log(`Removed E2E data: ${JSON.stringify(result)}`);
  } finally {
    await prisma.$disconnect();
  }
}
