import type { NextRequest } from "next/server";

import { handleProductionSubmitBallotRoute } from "../../../../../server/ballots/route-handlers";

export async function POST(request: NextRequest) {
  return handleProductionSubmitBallotRoute(request);
}
