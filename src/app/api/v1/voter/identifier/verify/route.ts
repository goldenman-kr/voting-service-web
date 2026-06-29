import type { NextRequest } from "next/server";

import { handleProductionIdentifierVerifyRoute } from "../../../../../../server/voters/route-handlers";

export async function POST(request: NextRequest) {
  return handleProductionIdentifierVerifyRoute(request);
}
