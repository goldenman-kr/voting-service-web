import { Role } from "../../guardrails/index.js";
import type { PrismaClientLike } from "../db/prisma";
import { createHmac } from "node:crypto";
import { hashAdminPassword } from "./password.ts";

export type BootstrapInitialAdminInput = Readonly<{
  email: string;
  password: string;
  hmacKey: string;
  tenantName?: string;
  organizationName?: string;
  roleCode?: string;
  confirmProduction?: boolean;
  nodeEnv?: string;
}>;

export type BootstrapInitialAdminResult = Readonly<{
  created: boolean;
  reason?: string;
  userId?: string;
  tenantId?: string;
  organizationId?: string;
  roleCode?: string;
}>;

const DEFAULT_TENANT_NAME = "Initial Tenant";
const DEFAULT_ORGANIZATION_NAME = "Initial Organization";
const PRODUCTION_CONFIRMATION_REQUIRED =
  "BOOTSTRAP_CONFIRM=CREATE_INITIAL_ADMIN is required in production";

function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashAdminEmail(email: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(normalizeAdminEmail(email)).digest("hex");
}

function assertBootstrapInput(input: BootstrapInitialAdminInput): void {
  if (input.nodeEnv === "production" && !input.confirmProduction) {
    throw new Error(PRODUCTION_CONFIRMATION_REQUIRED);
  }
  if (!input.email.trim()) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is required");
  }
  if (input.password.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");
  }
}

export async function bootstrapInitialAdmin(
  prisma: PrismaClientLike,
  input: BootstrapInitialAdminInput
): Promise<BootstrapInitialAdminResult> {
  assertBootstrapInput(input);
  const roleCode = input.roleCode ?? Role.ORGANIZATION_OWNER;

  const existingAdmin = await prisma.user.findFirst({
    where: {
      userRoles: {
        some: {
          role: {
            code: { in: [Role.SYSTEM_ADMIN, Role.ORGANIZATION_OWNER] }
          }
        }
      }
    },
    select: { id: true }
  });
  if (existingAdmin) {
    return Object.freeze({
      created: false,
      reason: "admin_already_exists",
      userId: existingAdmin.id
    });
  }

  const role = await prisma.role.findFirst({
    where: {
      organizationId: null,
      code: roleCode
    }
  });
  if (!role) {
    throw new Error(`Role ${roleCode} is not seeded. Run npm run db:seed first.`);
  }

  const { passwordHash } = await hashAdminPassword(input.password);
  const emailHash = hashAdminEmail(input.email, input.hmacKey);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.tenantName ?? DEFAULT_TENANT_NAME }
    });
    const organization = await tx.organization.create({
      data: {
        tenantId: tenant.id,
        name: input.organizationName ?? DEFAULT_ORGANIZATION_NAME
      }
    });
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        organizationId: organization.id,
        emailHash,
        passwordHash,
        status: "active",
        mfaRequired: true
      }
    });
    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id
      }
    });
    return { tenant, organization, user };
  });

  return Object.freeze({
    created: true,
    userId: result.user.id,
    tenantId: result.tenant.id,
    organizationId: result.organization.id,
    roleCode
  });
}
