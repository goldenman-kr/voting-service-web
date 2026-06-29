import type { NextRequest } from "next/server";

import {
  createProductionAdminAuthDependencies,
  handleAdminStepUpRoute
} from "../../../../../../server/auth/route-handlers";

export async function POST(request: NextRequest) {
  return handleAdminStepUpRoute(request, createProductionAdminAuthDependencies());
}
