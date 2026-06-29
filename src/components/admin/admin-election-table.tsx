import Link from "next/link";

import type { ElectionStateValue } from "../../domain/elections/state-machine";
import type { AdminElectionListItem } from "../../server/elections/admin-election-view";
import { StatusBadge } from "../ui/status-badge";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

export function AdminElectionTable({ elections }: { elections: readonly AdminElectionListItem[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-normal text-slate-600">
          <tr>
            <th className="px-4 py-3">투표</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">유형</th>
            <th className="px-4 py-3">일정</th>
            <th className="px-4 py-3">문항</th>
            <th className="px-4 py-3">유권자</th>
            <th className="px-4 py-3">최근 수정</th>
            <th className="px-4 py-3">작업</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {elections.map((election) => (
            <tr key={election.id}>
              <td className="px-4 py-4">
                <p className="font-medium text-slate-950">{election.title}</p>
                <p className="mt-1 text-xs text-slate-500">{election.description ?? "설명 없음"}</p>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={election.state as ElectionStateValue} size="sm" />
              </td>
              <td className="px-4 py-4">{election.electionType}</td>
              <td className="px-4 py-4 text-slate-600">
                {formatDate(election.startsAt)}
                <br />
                {formatDate(election.endsAt)}
              </td>
              <td className="px-4 py-4">{election.questionCount}</td>
              <td className="px-4 py-4">{election.eligibleVoterCount}</td>
              <td className="px-4 py-4 text-slate-600">{formatDate(election.updatedAt)}</td>
              <td className="px-4 py-4">
                <Link href={`/admin/elections/${election.id}`} className="font-semibold text-blue-700 hover:text-blue-900">
                  상세
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
