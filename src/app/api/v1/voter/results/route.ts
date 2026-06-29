import {
  createProductionPublicResultDependencies,
  handleGetVoterResultRoute
} from "../../../../../server/results/route-handlers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleGetVoterResultRoute(
    createProductionPublicResultDependencies(),
    url.searchParams.get("election_id") ?? undefined
  );
}
