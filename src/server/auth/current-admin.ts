import { cookies } from "next/headers";

import { parseEnv } from "../../lib/env";
import { getPrismaClient } from "../db/prisma";
import { ADMIN_SESSION_COOKIE_POLICY } from "./admin-session";
import { restoreAdminSession } from "./admin-auth-service";
import { createPrismaAdminAuthRepository } from "./prisma-repository";
import type { RestoredAdminSession } from "./repository";

export async function getCurrentAdminSessionFromCookies(): Promise<RestoredAdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_POLICY.name)?.value;
  if (!token) {
    return null;
  }

  const env = parseEnv();
  return restoreAdminSession({
    sessionToken: token,
    repository: createPrismaAdminAuthRepository(getPrismaClient()),
    context: { hmacKey: env.HMAC_KEY }
  });
}
