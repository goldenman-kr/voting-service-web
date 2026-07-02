import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { parseEnv } from "../src/lib/env.ts";
import { bootstrapInitialAdmin } from "../src/server/auth/bootstrap-admin.ts";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const env = parseEnv();
const prisma = new PrismaClient({ adapter: new PrismaPg(env.DATABASE_URL) });

try {
  const result = await bootstrapInitialAdmin(prisma, {
    username: process.env.BOOTSTRAP_ADMIN_USERNAME ?? "",
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "",
    hmacKey: env.HMAC_KEY,
    tenantName: process.env.BOOTSTRAP_TENANT_NAME,
    organizationName: process.env.BOOTSTRAP_ORGANIZATION_NAME,
    roleCode: process.env.BOOTSTRAP_ADMIN_ROLE,
    confirmProduction: process.env.BOOTSTRAP_CONFIRM === "CREATE_INITIAL_ADMIN",
    nodeEnv: process.env.NODE_ENV
  });

  if (result.created) {
    console.log(`Created initial admin user ${result.userId}`);
  } else {
    console.log(`Skipped initial admin bootstrap: ${result.reason}`);
  }
} finally {
  await prisma.$disconnect();
}
