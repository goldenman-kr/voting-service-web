import type { NextRequest } from "next/server";

import { handleProductionGetVoterCompletionStatusRoute } from "../../../../../server/ballots/route-handlers";

export async function GET(request: NextRequest) {
  return handleProductionGetVoterCompletionStatusRoute(request);
}
