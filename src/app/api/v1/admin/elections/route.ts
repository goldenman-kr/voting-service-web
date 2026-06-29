import type { NextRequest } from "next/server";

import {
  createProductionAdminElectionDependencies,
  handleCreateElectionRoute,
  handleListElectionsRoute
} from "../../../../../server/elections/route-handlers";

export async function POST(request: NextRequest) {
  return handleCreateElectionRoute(request, createProductionAdminElectionDependencies());
}

export async function GET() {
  return handleListElectionsRoute(createProductionAdminElectionDependencies());
}
