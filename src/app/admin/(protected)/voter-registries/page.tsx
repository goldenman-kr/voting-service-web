import Link from "next/link";

import { EmptyState } from "../../../../components/ui/empty-state";
import { PageHeader } from "../../../../components/ui/page-header";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { labelOf, registryStatusLabelMap } from "../../../../lib/ui/election-labels";
import { getCurrentAdminSessionFromCookies } from "../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../server/db/prisma";
import { listAdminVoterRegistrySummaries } from "../../../../server/elections/admin-election-view";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

export default async function AdminVoterRegistriesPage() {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const registries = await listAdminVoterRegistrySummaries(getPrismaClient(), restored.session);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="선거인명부 관리"
        title="선거인명부 현황"
        description="현재 시스템은 투표별 선거인명부를 사용합니다. 이 화면에서는 투표별 명부 상태를 확인하고 각 투표의 명부 관리 화면으로 이동할 수 있습니다."
        actions={
          <Link href="/admin/elections/new" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            새 투표 만들기
          </Link>
        }
      />

      <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        공통 선거인명부 생성, 기존 명부 불러오기, 사용된 명부 잠금, 복제 기능은 현재 schema에 없습니다.
        투표별 명부 구조를 공통 명부 구조로 확장하는 migration과 API 설계가 필요합니다.
      </section>

      {registries.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3">연결된 투표</th>
                <th className="px-4 py-3">투표 상태</th>
                <th className="px-4 py-3">명부 상태</th>
                <th className="px-4 py-3">확인 가능 인원</th>
                <th className="px-4 py-3">최근 수정</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {registries.map((registry) => (
                <tr key={registry.id}>
                  <td className="px-4 py-4 font-medium text-slate-950">{registry.election.title}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={registry.election.state} size="sm" />
                  </td>
                  <td className="px-4 py-4">{labelOf(registryStatusLabelMap, registry.status)}</td>
                  <td className="px-4 py-4">{registry.validRows}/{registry.totalRows}명</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(registry.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/elections/${registry.election.id}/voters`} className="font-semibold text-blue-700 hover:text-blue-900">
                      명부 관리
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="아직 등록된 선거인명부가 없습니다"
          description="투표 생성 과정에서 명부를 입력하면 이 화면에 투표별 명부가 표시됩니다."
          action={
            <Link href="/admin/elections/new" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
              투표 생성
            </Link>
          }
        />
      )}
    </div>
  );
}
