import { randomBytes } from "node:crypto";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleScope } from "@prisma/client";

import { PERMISSIONS, ROLE_PERMISSIONS, Role } from "../../src/guardrails/index.js";
import { hashAdminUsername } from "../../src/server/auth/admin-auth-service";
import { hashAdminPassword } from "../../src/server/auth/password";
import { hashInviteToken, hashVoterIdentifier } from "../../src/server/voters/voter-auth-service";

loadEnvFile(".env");

const REQUIRED_OPERATOR_PERMISSIONS = Object.freeze([
  "election.read",
  "election.create",
  "election.update",
  "election.request_review",
  "question.read",
  "question.write",
  "auth_policy.read",
  "auth_policy.write",
  "voter_registry.read",
  "voter_registry.import",
  "voter_registry.validate",
  "eligible_voter.read",
  "invitation.read",
  "invitation.send",
  "invitation.resend",
  "participation.read",
  "credential.read",
  "election.approve",
  "election.schedule",
  "election.open",
  "election.pause",
  "election.resume",
  "election.close",
  "result.read",
  "result.tally",
  "result.confirm",
  "result.publish",
  "result.correct.request",
  "election.invalidate",
  "report.export.request"
]);

const roleScopeByCode: Readonly<Record<string, RoleScope>> = Object.freeze({
  [Role.SYSTEM_ADMIN]: RoleScope.system,
  [Role.ORGANIZATION_OWNER]: RoleScope.organization,
  [Role.ELECTION_MANAGER]: RoleScope.election,
  [Role.ELECTION_APPROVER]: RoleScope.election,
  [Role.AUDITOR]: RoleScope.organization,
  [Role.RESULT_PUBLISHER]: RoleScope.election,
  [Role.PRIVACY_ADMIN]: RoleScope.organization,
  [Role.SECURITY_ADMIN]: RoleScope.organization,
  [Role.VOTER]: RoleScope.election,
  [Role.PUBLIC_VIEWER]: RoleScope.system
});

export type E2eFixture = Readonly<{
  runId: string;
  adminUsername: string;
  adminPassword: string;
  voterIdentifier: string;
  inviteToken: string;
  electionTitle: string;
  tenantId: string;
  organizationId: string;
  userId: string;
}>;

export function createE2ePrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Playwright E2E tests");
  }
  return new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
}

function requiredHmacKey(): string {
  const hmacKey = process.env.HMAC_KEY;
  if (!hmacKey) {
    throw new Error("HMAC_KEY is required for Playwright E2E tests");
  }
  return hmacKey;
}

function randomRunId(): string {
  return `e2e-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export async function seedRbacForE2e(prisma: PrismaClient): Promise<void> {
  const permissions = new Map<string, { id: string }>();
  for (const permission of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        description: permission.description,
        riskLevel: permission.risk
      },
      create: {
        code: permission.code,
        description: permission.description,
        riskLevel: permission.risk
      }
    });
    permissions.set(permission.code, record);
  }

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const existing = await prisma.role.findFirst({
      where: { organizationId: null, code: roleCode }
    });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: {
            name: roleCode,
            scope: roleScopeByCode[roleCode] ?? RoleScope.organization,
            isSystemRole: true,
            status: "active"
          }
        })
      : await prisma.role.create({
          data: {
            code: roleCode,
            name: roleCode,
            scope: roleScopeByCode[roleCode] ?? RoleScope.organization,
            isSystemRole: true,
            status: "active"
          }
        });

    for (const permissionCode of permissionCodes) {
      const permission = permissions.get(permissionCode);
      if (!permission) throw new Error(`Missing permission ${permissionCode}`);
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }
}

export async function prepareE2eFixture(prisma: PrismaClient): Promise<E2eFixture> {
  const hmacKey = requiredHmacKey();
  await seedRbacForE2e(prisma);

  const runId = randomRunId();
  const adminUsername = `admin-${runId}`;
  const adminPassword = `E2E-${randomBytes(18).toString("base64url")}!`;
  const voterIdentifier = `MEM-${runId}`;
  const inviteToken = `invite-${runId}-${randomBytes(16).toString("base64url")}`;
  const electionTitle = `E2E Smoke Election ${runId}`;

  const tenant = await prisma.tenant.create({
    data: { name: `E2E Smoke Tenant ${runId}` }
  });
  const organization = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: `E2E Smoke Organization ${runId}`
    }
  });
  const { passwordHash } = await hashAdminPassword(adminPassword);
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      organizationId: organization.id,
      emailHash: hashAdminUsername(adminUsername, hmacKey),
      passwordHash,
      status: "active",
      mfaRequired: true
    }
  });
  const role = await prisma.role.create({
    data: {
      organizationId: organization.id,
      code: `E2EOperator-${runId}`,
      name: "E2E Operator",
      scope: "organization",
      status: "active"
    }
  });

  for (const permissionCode of REQUIRED_OPERATOR_PERMISSIONS) {
    const permission = await prisma.permission.findUnique({ where: { code: permissionCode } });
    if (!permission) throw new Error(`Missing permission ${permissionCode}`);
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id
      }
    });
  }

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id
    }
  });

  return Object.freeze({
    runId,
    adminUsername,
    adminPassword,
    voterIdentifier,
    inviteToken,
    electionTitle,
    tenantId: tenant.id,
    organizationId: organization.id,
    userId: user.id
  });
}

export async function findElectionByTitle(prisma: PrismaClient, title: string) {
  const election = await prisma.election.findFirst({
    where: { title },
    orderBy: { createdAt: "desc" }
  });
  if (!election) {
    throw new Error(`Election not found for title ${title}`);
  }
  return election;
}

export async function ensureKnownInviteTokenForElection({
  prisma,
  electionId,
  voterIdentifier,
  inviteToken
}: {
  prisma: PrismaClient;
  electionId: string;
  voterIdentifier: string;
  inviteToken: string;
}) {
  const hmacKey = requiredHmacKey();
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { authenticationPolicy: true }
  });
  if (!election) throw new Error(`Election ${electionId} not found`);
  const externalIdentifierHmac = hashVoterIdentifier(voterIdentifier, hmacKey);
  const eligibleVoter = await prisma.eligibleVoter.findFirst({
    where: { electionId, externalIdentifierHmac }
  });
  if (!eligibleVoter) {
    throw new Error("E2E eligible voter was not created by the admin UI import");
  }
  const credential =
    (await prisma.votingCredential.findFirst({
      where: { electionId, eligibleVoterId: eligibleVoter.id }
    })) ??
    (await prisma.votingCredential.create({
      data: {
        electionId,
        eligibleVoterId: eligibleVoter.id
      }
    }));

  const inviteTokenHash = hashInviteToken(inviteToken, hmacKey);
  const existingInvitation = await prisma.invitation.findFirst({
    where: { electionId, eligibleVoterId: eligibleVoter.id },
    orderBy: { createdAt: "desc" }
  });
  if (existingInvitation) {
    await prisma.invitation.update({
      where: { id: existingInvitation.id },
      data: {
        inviteTokenHash,
        status: "sent",
        sentAt: new Date(),
        lastSentAt: new Date(),
        sendCount: { increment: 1 },
        expiresAt: election.endsAt
      }
    });
  } else {
    await prisma.invitation.create({
      data: {
        electionId,
        eligibleVoterId: eligibleVoter.id,
        inviteTokenHash,
        channel: "email",
        status: "sent",
        sentAt: new Date(),
        lastSentAt: new Date(),
        sendCount: 1,
        expiresAt: election.endsAt
      }
    });
  }

  return Object.freeze({
    electionId,
    eligibleVoterId: eligibleVoter.id,
    votingCredentialId: credential.id
  });
}
