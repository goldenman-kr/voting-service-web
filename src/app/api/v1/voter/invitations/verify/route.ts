import type { NextRequest } from "next/server";

import { handleProductionInvitationVerifyRoute } from "../../../../../../server/voters/route-handlers";

export async function POST(request: NextRequest) {
  return handleProductionInvitationVerifyRoute(request);
}
