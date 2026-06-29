import Link from "next/link";

import { MetricCard } from "../../../components/admin/admin-cards";
import { AdminElectionTable } from "../../../components/admin/admin-election-table";
import { PageHeader } from "../../../components/ui/page-header";
import { AuditNotice } from "../../../components/ui/audit-notice";
import { PrivacyNotice } from "../../../components/ui/privacy-notice";
import { ElectionState } from "../../../guardrails/index.js";
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
        description="MVP 운영 흐름 확인을 위한 기본 화면입니다. 모든 위험 작업은 사유와 감사 기록 안내를 동반합니다."
        actions={
          <Link href="/admin/elections/new" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            투표 생성
          </Link>
        }
      />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="전체 투표" value={dashboard.totalCount} hint="권한 범위 내 투표" />
        <MetricCard label="검수 대기" value={dashboard.byState[ElectionState.READY_FOR_REVIEW] ?? 0} hint="승인자 확인 필요" />
        <MetricCard label="진행 중" value={dashboard.byState[ElectionState.OPEN] ?? 0} hint="투표 참여 가능 상태" />
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Draft" value={dashboard.byState[ElectionState.DRAFT] ?? 0} />
        <MetricCard label="Closed" value={dashboard.byState[ElectionState.CLOSED] ?? 0} />
        <MetricCard label="Published" value={dashboard.byState[ElectionState.PUBLISHED] ?? 0} />
        <MetricCard label="검수 대기 항목" value={dashboard.reviewWaiting.length} />
      </section>
      <PrivacyNotice />
      <AuditNotice eventType="상태 변경과 결과 공개" riskLevel="high" />
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">최근 투표</h2>
        <AdminElectionTable elections={dashboard.recent} />
      </section>
    </div>
  );
}
