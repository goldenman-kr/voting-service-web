import Link from "next/link";

import { AdminElectionSections } from "../../../../components/admin/admin-election-table";
import { PageHeader } from "../../../../components/ui/page-header";
import { getCurrentAdminSessionFromCookies } from "../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../server/db/prisma";
import { listAdminElectionItems } from "../../../../server/elections/admin-election-view";

export default async function AdminElectionsPage() {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const elections = await listAdminElectionItems(getPrismaClient(), restored.session);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="투표 관리"
        title="투표 목록"
        description="상태별로 가능한 작업만 노출합니다. 익명투표 참여 현황은 집계 중심으로 표시합니다."
        actions={
          <Link href="/admin/elections/new" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            새 투표
          </Link>
        }
      />
      <AdminElectionSections elections={elections} />
    </div>
  );
}
