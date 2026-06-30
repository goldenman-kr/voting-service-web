import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AddManagedVoterDialog,
  ManagedVoterRowActions
} from "../../../../../components/admin/managed-voter-registry-forms";
import { PageHeader } from "../../../../../components/ui/page-header";
import { getCurrentAdminSessionFromCookies } from "../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../server/db/prisma";
import { getManagedVoterRegistryDetail } from "../../../../../server/voter-registries/admin-view";

type Params = {
  params: Promise<{ registry_id: string }> | { registry_id: string };
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

export default async function ManagedVoterRegistryDetailPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const registry = await getManagedVoterRegistryDetail(
    getPrismaClient(),
    restored.session,
    (await params).registry_id
  );
  if (!registry) notFound();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="선거인명부 관리"
        title={registry.title}
        description={registry.description || "독립 선거인명부 상세"}
        actions={
          <Link href="/admin/voter-registries" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            명부현황
          </Link>
        }
      />

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">명부 상태</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              선거인 {registry.validRows}/{registry.totalRows}명 · 생성 {formatDate(registry.createdAt)} · 수정 {formatDate(registry.updatedAt)}
            </p>
          </div>
          {registry.editable ? (
            <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">수정 가능</span>
          ) : (
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">사용됨 · 수정 불가</span>
          )}
        </div>
        {!registry.editable ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
            이 명부는 이미 투표에 사용되어 잠겼습니다. 선거인 추가, 수정, 삭제가 필요하면 복제한 뒤 새 명부에서 작업해 주세요.
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">선거인 목록</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              투표 내용과 연결되는 내부 정보는 표시하지 않습니다.
            </p>
          </div>
          <AddManagedVoterDialog registryId={registry.id} editable={registry.editable} />
        </div>
        {registry.voters.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-normal text-slate-600">
                <tr>
                  <th className="px-4 py-3">호수번호</th>
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">식별번호</th>
                  <th className="px-4 py-3">생년월일</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {registry.voters.map((voter) => (
                  <tr key={voter.id}>
                    <td className="px-4 py-3">{voter.householdNumber}</td>
                    <td className="px-4 py-3">{voter.name}</td>
                    <td className="px-4 py-3">{voter.identifierLast4}</td>
                    <td className="px-4 py-3">{voter.birthDate6}</td>
                    <td className="px-4 py-3">{voter.status === "active" ? "활성" : "제외됨"}</td>
                    <td className="px-4 py-3">
                      <ManagedVoterRowActions registryId={registry.id} voter={voter} editable={registry.editable} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            아직 표시할 선거인이 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}
