import type { NextRequest } from "next/server";

import {
  createProductionAdminAuthDependencies,
  handleAdminLogoutRoute
} from "../../../../../../server/auth/route-handlers";

export async function POST(request: NextRequest) {
  return handleAdminLogoutRoute(request, createProductionAdminAuthDependencies());
}
