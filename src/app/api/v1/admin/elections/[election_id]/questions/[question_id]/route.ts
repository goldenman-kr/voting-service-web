import type { NextRequest } from "next/server";

import {
  createProductionAdminElectionDependencies,
  handleUpdateQuestionRoute
} from "../../../../../../../../server/elections/route-handlers";

type Params = {
  params:
    | Promise<{ election_id: string; question_id: string }>
    | { election_id: string; question_id: string };
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const resolved = await params;
  return handleUpdateQuestionRoute(
    request,
    resolved.election_id,
    resolved.question_id,
    createProductionAdminElectionDependencies()
  );
}
