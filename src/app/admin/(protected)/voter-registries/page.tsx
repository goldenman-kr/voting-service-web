import Link from "next/link";

import { EmptyState } from "../../../../components/ui/empty-state";
import { PageHeader } from "../../../../components/ui/page-header";
import { getCurrentAdminSessionFromCookies } from "../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../server/db/prisma";
import { listManagedVoterRegistrySummaries } from "../../../../server/voter-registries/admin-view";
import { cloneManagedRegistryAction } from "../../../../server/voter-registries/admin-actions";

function formatDateTimeParts(date: Date): { date: string; time: string } {
  const dateText = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);

  const timeText = new Intl.DateTimeFormat("ko-KR", {
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);

  return { date: dateText, time: timeText };
}

function DateTimeCell({ value }: { value: Date }) {
  const parts = formatDateTimeParts(value);
  return (
    <time dateTime={value.toISOString()} className="grid gap-1 whitespace-nowrap leading-5 text-slate-600">
      <span>{parts.date}</span>
      <span className="text-xs text-slate-500">{parts.time}</span>
    </time>
  );
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
          <Link href="/admin/voter-registries/new" className="ui-primary-button">
            새 명부 만들기
          </Link>
        }
      />

      {registries.length > 0 ? (
        <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col />
              <col className="w-[5rem]" />
              <col className="w-[7.5rem]" />
              <col className="w-[5.5rem]" />
              <col className="w-[5.5rem]" />
              <col className="w-[6rem]" />
            </colgroup>
            <thead className="bg-surface text-xs font-bold text-ink-faint">
              <tr>
                <th className="px-4 py-3">명부</th>
                <th className="px-3 py-3 [word-break:keep-all]">선거인 수</th>
                <th className="px-3 py-3 [word-break:keep-all]">수정 가능 여부</th>
                <th className="px-3 py-3 [word-break:keep-all]">생성일</th>
                <th className="px-3 py-3 [word-break:keep-all]">수정일</th>
                <th className="px-3 py-3 [word-break:keep-all]">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {registries.map((registry) => (
                <tr key={registry.id} className="align-top transition hover:bg-surface/70">
                  <td className="px-4 py-4">
                    <p className="whitespace-normal break-words font-bold leading-6 text-ink [word-break:keep-all]">
                      {registry.title}
                    </p>
                    <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-ink-faint [word-break:keep-all]">
                      {registry.description || "설명 없음"}
                    </p>
                  </td>
                  <td className="px-3 py-4 whitespace-normal [overflow-wrap:break-word] [word-break:keep-all]">{registry.validRows}/{registry.totalRows}명</td>
                  <td className="px-3 py-4 whitespace-normal leading-5 [overflow-wrap:break-word] [word-break:keep-all]">
                    {registry.editable ? (
                      <span className="inline-block max-w-full rounded-lg border border-[#CDE9D8] bg-[#E9F6EF] px-2.5 py-1 text-center text-xs font-bold text-[#1F7A4D] [word-break:keep-all]">수정 가능</span>
                    ) : (
                      <span className="inline-block max-w-full rounded-lg border border-[#E0E5EE] bg-[#EEF1F6] px-2.5 py-1 text-center text-xs font-bold text-[#5A6577] [word-break:keep-all]">시작됨 · 수정 불가</span>
                    )}
                  </td>
                  <td className="px-3 py-4 [word-break:keep-all]"><DateTimeCell value={registry.createdAt} /></td>
                  <td className="px-3 py-4 [word-break:keep-all]"><DateTimeCell value={registry.updatedAt} /></td>
                  <td className="px-3 py-4 [word-break:keep-all]">
                    <div className="grid justify-items-start gap-1.5">
                      <Link
                        href={`/admin/voter-registries/${registry.id}`}
                        className="whitespace-nowrap rounded-lg border border-line-input px-2.5 py-1.5 text-xs font-bold text-ink-muted hover:bg-surface"
                      >
                        명부 관리
                      </Link>
                      <form action={cloneManagedRegistryAction}>
                        <input type="hidden" name="registryId" value={registry.id} />
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-lg border border-brand-100 px-2.5 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-50"
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
            <Link href="/admin/voter-registries/new" className="ui-primary-button">
              새 명부 만들기
            </Link>
          }
        />
      )}
    </div>
  );
}
