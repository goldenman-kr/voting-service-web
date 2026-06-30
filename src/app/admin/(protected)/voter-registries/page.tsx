import Link from "next/link";

import { EmptyState } from "../../../../components/ui/empty-state";
import { PageHeader } from "../../../../components/ui/page-header";
import { getCurrentAdminSessionFromCookies } from "../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../server/db/prisma";
import { listManagedVoterRegistrySummaries } from "../../../../server/voter-registries/admin-view";
import { cloneManagedRegistryAction } from "../../../../server/voter-registries/admin-actions";

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
  const registries = await listManagedVoterRegistrySummaries(getPrismaClient(), restored.session);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="선거인명부 관리"
        title="독립 선거인명부"
        description="투표 생성과 분리해 선거인명부를 만들고, 실제 시작된 투표에서 사용 중인지에 따라 수정 가능 상태를 관리합니다."
        actions={
          <Link href="/admin/voter-registries/new" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            새 명부 만들기
          </Link>
        }
      />

      {registries.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3">명부 제목</th>
                <th className="px-4 py-3">설명</th>
                <th className="px-4 py-3">선거인 수</th>
                <th className="px-4 py-3">사용 여부</th>
                <th className="px-4 py-3">수정 가능 여부</th>
                <th className="px-4 py-3">생성일</th>
                <th className="px-4 py-3">수정일</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {registries.map((registry) => (
                <tr key={registry.id}>
                  <td className="px-4 py-4 font-medium text-slate-950">{registry.title}</td>
                  <td className="px-4 py-4 text-slate-600">{registry.description || "-"}</td>
                  <td className="px-4 py-4">{registry.validRows}/{registry.totalRows}명</td>
                  <td className="px-4 py-4">{registry.used ? "시작된 투표에서 사용 중" : "시작된 투표 없음"}</td>
                  <td className="px-4 py-4">
                    {registry.editable ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">수정 가능</span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">시작됨 · 수정 불가</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(registry.createdAt)}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(registry.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/voter-registries/${registry.id}`}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        명부 관리
                      </Link>
                      <form action={cloneManagedRegistryAction}>
                        <input type="hidden" name="registryId" value={registry.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700"
                        >
                          복제하기
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="아직 등록된 선거인명부가 없습니다"
          description="투표와 독립된 명부를 먼저 만든 뒤 투표 생성 과정에서 연결할 수 있습니다."
          action={
            <Link href="/admin/voter-registries/new" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
              새 명부 만들기
            </Link>
          }
        />
      )}
    </div>
  );
}
