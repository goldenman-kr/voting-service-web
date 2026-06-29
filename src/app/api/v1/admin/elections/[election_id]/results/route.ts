import {
  createProductionAdminResultDependencies,
  handleGetResultRoute
} from "../../../../../../../server/results/route-handlers";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export async function GET(_request: Request, { params }: Params) {
  return handleGetResultRoute((await params).election_id, createProductionAdminResultDependencies());
}
