import type { NextRequest } from "next/server";

import {
  createProductionAdminResultDependencies,
  handleApproveCorrectionRoute
} from "../../../../../../../../../server/results/route-handlers";

type Params = {
  params:
    | Promise<{ election_id: string; correction_id: string }>
    | { election_id: string; correction_id: string };
};

export async function POST(request: NextRequest, { params }: Params) {
  const resolved = await params;
  return handleApproveCorrectionRoute(
    request,
    resolved.election_id,
    resolved.correction_id,
    createProductionAdminResultDependencies()
  );
}
