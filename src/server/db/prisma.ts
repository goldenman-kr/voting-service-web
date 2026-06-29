import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { parseEnv } from "../../lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const env = parseEnv();
  return new PrismaClient({
    adapter: new PrismaPg(env.DATABASE_URL)
  });
}

export function getPrismaClient(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

export type PrismaClientLike = PrismaClient;
