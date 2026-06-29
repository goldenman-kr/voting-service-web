import type { NextRequest } from "next/server";

import {
  createProductionAdminResultDependencies,
  handleCreateReportExportRequestRoute
} from "../../../../../../../server/results/route-handlers";

type Params = {
  params: Promise<{ report_id: string }> | { report_id: string };
};

export async function POST(request: NextRequest, { params }: Params) {
  return handleCreateReportExportRequestRoute(
    request,
    (await params).report_id,
    createProductionAdminResultDependencies()
  );
}
