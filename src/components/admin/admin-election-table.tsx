import Link from "next/link";

import type { ElectionStateValue } from "../../domain/elections/state-machine";
import { ElectionState } from "../../guardrails/index.js";
import { electionTypeShortLabelMap, labelOf } from "../../lib/ui/election-labels";
import type { AdminElectionListItem } from "../../server/elections/admin-election-view";
import { DeletePreStartElectionForm } from "./delete-election-form";
import { EmptyState } from "../ui/empty-state";
import { StatusBadge } from "../ui/status-badge";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

export function AdminElectionTable({ elections }: { elections: readonly AdminElectionListItem[] }) {
  if (elections.length === 0) {
    return (
      <EmptyState
        title="아직 생성된 투표가 없습니다"
        description="새 투표를 만들면 작성 중, 진행 중, 완료된 투표가 이 목록에 표시됩니다."
        action={
          <Link href="/admin/elections/new" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            투표 생성
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[40%]" />
          <col className="w-[7rem]" />
          <col className="w-[5rem]" />
          <col className="w-[14rem]" />
          <col className="w-[5rem]" />
          <col className="w-[7rem]" />
        </colgroup>
        <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-normal text-slate-600">
          <tr>
            <th className="px-4 py-3">투표</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">유형</th>
            <th className="px-4 py-3">일정</th>
            <th className="px-4 py-3">유권자</th>
            <th className="px-4 py-3">작업</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {elections.map((election) => (
            <tr key={election.id} className="align-top">
              <td className="px-4 py-4">
                <p className="whitespace-normal break-words font-medium leading-6 text-slate-950 [word-break:keep-all]">
                  {election.title}
                </p>
                <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-slate-500 [word-break:keep-all]">
                  {election.description ?? "설명 없음"}
                </p>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <StatusBadge status={election.state as ElectionStateValue} size="sm" />
              </td>
              <td className="px-4 py-4 whitespace-normal leading-6 [word-break:keep-all]">
                {labelOf(electionTypeShortLabelMap, election.electionType)}
              </td>
              <td className="px-4 py-4 text-slate-600">
                <dl className="grid gap-1 leading-6">
                  <div className="grid grid-cols-[2.5rem_1fr] gap-2">
                    <dt className="font-semibold text-slate-500">시작</dt>
                    <dd>{formatDate(election.startsAt)}</dd>
                  </div>
                  <div className="grid grid-cols-[2.5rem_1fr] gap-2">
                    <dt className="font-semibold text-slate-500">종료</dt>
                    <dd>{formatDate(election.endsAt)}</dd>
                  </div>
                </dl>
              </td>
              <td className="px-4 py-4 text-center">{election.eligibleVoterCount}</td>
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/elections/${election.id}`} className="font-semibold text-blue-700 hover:text-blue-900">
                    상세
                  </Link>
                  {canDeletePreStartElection(election) ? (
                    <DeletePreStartElectionForm electionId={election.id} title={election.title} compact />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const setupStates = new Set<ElectionStateValue>([
  ElectionState.DRAFT,
  ElectionState.READY_FOR_REVIEW,
  ElectionState.APPROVED,
  ElectionState.SCHEDULED,
  ElectionState.NOTICE
]);

function canDeletePreStartElection(election: AdminElectionListItem): boolean {
  return setupStates.has(election.state) && election.startsAt > new Date();
}

const activeStates = new Set<ElectionStateValue>([ElectionState.OPEN, ElectionState.PAUSED]);

const completedStates = new Set<ElectionStateValue>([
  ElectionState.CLOSED,
  ElectionState.TALLYING,
  ElectionState.PENDING_CONFIRMATION,
  ElectionState.CONFIRMED,
  ElectionState.PUBLISHED,
  ElectionState.ARCHIVED,
  ElectionState.INVALIDATED
]);

function ElectionSection({
  title,
  description,
  elections,
  emptyMessage
}: {
  title: string;
  description: string;
  elections: readonly AdminElectionListItem[];
  emptyMessage: string;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {elections.length > 0 ? (
        <AdminElectionTable elections={elections} />
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

export function AdminElectionSections({ elections }: { elections: readonly AdminElectionListItem[] }) {
  const setup = elections.filter((election) => setupStates.has(election.state));
  const active = elections.filter((election) => activeStates.has(election.state));
  const completed = elections.filter((election) => completedStates.has(election.state));

  if (elections.length === 0) {
    return <AdminElectionTable elections={elections} />;
  }

  return (
    <div className="grid gap-8">
      <ElectionSection
        title="시작 전 / 작성 중"
        description="아직 투표가 시작되지 않았습니다. 상태에 따라 설정 보완, 검수 요청, 승인 또는 시작 준비를 진행합니다."
        elections={setup}
        emptyMessage="시작 전이거나 작성 중인 투표가 없습니다."
      />
      <ElectionSection
        title="현재 진행 중"
        description="유권자가 참여할 수 있거나 일시중단된 투표입니다. 진행 중에는 문항과 명부 수정이 제한됩니다."
        elections={active}
        emptyMessage="현재 진행 중인 투표가 없습니다."
      />
      <ElectionSection
        title="완료된 투표"
        description="마감, 집계, 확정, 공개 또는 보관 단계의 투표입니다. 공개 결과는 직접 덮어쓰지 않습니다."
        elections={completed}
        emptyMessage="완료된 투표가 없습니다."
      />
    </div>
  );
}
