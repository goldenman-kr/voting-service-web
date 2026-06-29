import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadEnvFile } from "node:process";

import { PERMISSIONS, ROLE_PERMISSIONS, Role } from "../src/guardrails/index.js";

loadEnvFile(".env");

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const roleScopeByCode = Object.freeze({
  [Role.SYSTEM_ADMIN]: "system",
  [Role.ORGANIZATION_OWNER]: "organization",
  [Role.ELECTION_MANAGER]: "election",
  [Role.ELECTION_APPROVER]: "election",
  [Role.AUDITOR]: "organization",
  [Role.RESULT_PUBLISHER]: "election",
  [Role.PRIVACY_ADMIN]: "organization",
  [Role.SECURITY_ADMIN]: "organization",
  [Role.VOTER]: "election",
  [Role.PUBLIC_VIEWER]: "system"
});

async function upsertSystemRole(code) {
  const existing = await prisma.role.findFirst({
    where: {
      organizationId: null,
      code
    }
  });
  const data = {
    code,
    name: code,
    scope: roleScopeByCode[code] ?? "organization",
    isSystemRole: true,
    status: "active"
  };
  if (existing) {
    return prisma.role.update({
      where: { id: existing.id },
      data
    });
  }
  return prisma.role.create({
    data
  });
}

async function main() {
  const permissions = new Map();
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
    const role = await upsertSystemRole(roleCode);
    for (const permissionCode of permissionCodes) {
      const permission = permissions.get(permissionCode);
      if (!permission) {
        throw new Error(`Permission ${permissionCode} referenced by ${roleCode} is not defined`);
      }
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
