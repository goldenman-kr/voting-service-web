import type { NextRequest } from "next/server";

import { handleProductionGetVoterElectionInfoRoute } from "../../../../../../server/ballots/route-handlers";

export async function GET(request: NextRequest) {
  return handleProductionGetVoterElectionInfoRoute(request);
}
