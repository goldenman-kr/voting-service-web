import type { NextRequest } from "next/server";

import {
  createProductionAdminAuthDependencies,
  handleAdminMeRoute
} from "../../../../../../server/auth/route-handlers";

export async function GET(request: NextRequest) {
  return handleAdminMeRoute(request, createProductionAdminAuthDependencies());
}
