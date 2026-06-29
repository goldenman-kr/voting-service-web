import type { NextRequest } from "next/server";

import {
  createProductionAdminResultDependencies,
  handleTallyResultRoute
} from "../../../../../../../../server/results/route-handlers";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export async function POST(request: NextRequest, { params }: Params) {
  return handleTallyResultRoute(
    request,
    (await params).election_id,
    createProductionAdminResultDependencies()
  );
}
