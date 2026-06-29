import type { NextRequest } from "next/server";

import {
  createProductionAdminResultDependencies,
  handleConfirmResultRoute
} from "../../../../../../../../server/results/route-handlers";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export async function POST(request: NextRequest, { params }: Params) {
  return handleConfirmResultRoute(
    request,
    (await params).election_id,
    createProductionAdminResultDependencies()
  );
}
