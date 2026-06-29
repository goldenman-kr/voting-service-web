import type { NextRequest } from "next/server";

import { handleProductionSubmitRevoteRoute } from "../../../../../../server/ballots/route-handlers";

export async function POST(request: NextRequest) {
  return handleProductionSubmitRevoteRoute(request);
}
