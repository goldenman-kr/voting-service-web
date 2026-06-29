import type { NextRequest } from "next/server";

import {
  createProductionAdminElectionDependencies,
  handleGetElectionRoute,
  handleUpdateElectionRoute
} from "../../../../../../server/elections/route-handlers";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

async function electionIdFrom({ params }: Params) {
  return (await params).election_id;
}

export async function GET(_request: NextRequest, context: Params) {
  return handleGetElectionRoute(
    await electionIdFrom(context),
    createProductionAdminElectionDependencies()
  );
}

export async function PATCH(request: NextRequest, context: Params) {
  return handleUpdateElectionRoute(
    request,
    await electionIdFrom(context),
    createProductionAdminElectionDependencies()
  );
}
