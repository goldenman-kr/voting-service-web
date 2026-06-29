import {
  createProductionAdminResultDependencies,
  handleGetReportExportDownloadRoute
} from "../../../../../../../server/results/route-handlers";

type Params = {
  params: Promise<{ export_id: string }> | { export_id: string };
};

export async function GET(_request: Request, { params }: Params) {
  return handleGetReportExportDownloadRoute(
    (await params).export_id,
    createProductionAdminResultDependencies()
  );
}
