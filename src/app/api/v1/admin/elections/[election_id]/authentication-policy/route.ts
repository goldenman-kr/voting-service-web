import type { NextRequest } from "next/server";

import {
  createProductionAdminElectionDependencies,
  handleConfigureAuthenticationPolicyRoute
} from "../../../../../../../server/elections/route-handlers";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export async function PUT(request: NextRequest, { params }: Params) {
  return handleConfigureAuthenticationPolicyRoute(
    request,
    (await params).election_id,
    createProductionAdminElectionDependencies()
  );
}
