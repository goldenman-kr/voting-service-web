import Link from "next/link";

import { MetricCard } from "../../../components/admin/admin-cards";
import { AdminElectionTable } from "../../../components/admin/admin-election-table";
import { AnonymousVotingNotice } from "../../../components/ui/anonymous-voting-notice";
import { PageHeader } from "../../../components/ui/page-header";
import { getCurrentAdminSessionFromCookies } from "../../../server/auth/current-admin";
import { getPrismaClient } from "../../../server/db/prisma";
import { getAdminElectionDashboard } from "../../../server/elections/admin-election-view";

export default async function AdminDashboardPage() {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const dashboard = await getAdminElectionDashboard(getPrismaClient(), restored.session);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="관리자 포털"
        title="대시보드"
        description="투표 운영 현황과 다음에 확인할 항목을 한눈에 볼 수 있습니다."
        actions={
          <Link href="/admin/elections/new" className="ui-primary-button">
            투표 생성
          </Link>
        }
      />
      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard label="전체 투표" value={dashboard.totalCount} hint="현재 조직에서 관리 중인 모든 투표입니다." />
        <MetricCard label="시작 전 투표" value={dashboard.preStartCount} hint="작성, 검수, 승인, 예약 단계의 투표입니다." />
        <MetricCard label="현재 진행 중" value={dashboard.activeCount} hint="유권자가 참여할 수 있거나 일시중단된 투표입니다." featured />
        <MetricCard label="완료된 투표" value={dashboard.completedCount} hint="마감 이후 집계, 확정, 공개, 보관 또는 무효 처리된 투표입니다." />
        <MetricCard label="관리 중인 명부" value={dashboard.registryCount} hint="투표에 연결된 선거인 명부 수입니다." />
      </section>
      <AnonymousVotingNotice audience="admin" />
      <section className="grid gap-3">
        <h2 className="text-lg font-bold text-ink">최근 투표</h2>
        <AdminElectionTable elections={dashboard.recent} />
      </section>
    </div>
  );
}
