import type { NextRequest } from "next/server";

import {
  createProductionAdminElectionDependencies,
  handleCreateOptionRoute
} from "../../../../../../../../../server/elections/route-handlers";

type Params = {
  params:
    | Promise<{ election_id: string; question_id: string }>
    | { election_id: string; question_id: string };
};

export async function POST(request: NextRequest, { params }: Params) {
  const resolved = await params;
  return handleCreateOptionRoute(
    request,
    resolved.election_id,
    resolved.question_id,
    createProductionAdminElectionDependencies()
  );
}
