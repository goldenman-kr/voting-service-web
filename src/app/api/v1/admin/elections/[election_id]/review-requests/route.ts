import type { NextRequest } from "next/server";

import {
  createProductionAdminElectionDependencies,
  handleRequestElectionReviewRoute
} from "../../../../../../../server/elections/route-handlers";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export async function POST(request: NextRequest, { params }: Params) {
  return handleRequestElectionReviewRoute(
    request,
    (await params).election_id,
    createProductionAdminElectionDependencies()
  );
}
