import type { NextRequest } from "next/server";

import {
  createProductionAdminAuthDependencies,
  handleAdminLoginRoute
} from "../../../../../../server/auth/route-handlers";

export async function POST(request: NextRequest) {
  return handleAdminLoginRoute(request, createProductionAdminAuthDependencies());
}
