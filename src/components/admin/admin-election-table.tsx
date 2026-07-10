import Link from "next/link";

import type { ElectionStateValue } from "../../domain/elections/state-machine";
import { ElectionState } from "../../guardrails/index.js";
import { electionTypeShortLabelMap, labelOf } from "../../lib/ui/election-labels";
import type { AdminElectionListItem } from "../../server/elections/admin-election-view";
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
          <Link href="/admin/elections/new" className="ui-primary-button">
            투표 생성
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col />
          <col className="w-[6.5rem]" />
          <col className="w-[4.5rem]" />
          <col className="w-[13rem]" />
          <col className="w-[5rem]" />
        </colgroup>
        <thead className="bg-surface text-xs font-bold text-ink-faint">
          <tr>
            <th className="px-4 py-3 [word-break:keep-all]">투표 (상세보기는 제목을 클릭)</th>
            <th className="px-3 py-3 [word-break:keep-all]">상태</th>
            <th className="px-3 py-3 [word-break:keep-all]">유형</th>
            <th className="px-3 py-3 [word-break:keep-all]">일정</th>
            <th className="px-3 py-3 text-center [word-break:keep-all]">유권자수</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {elections.map((election) => (
            <tr key={election.id} className="align-top transition hover:bg-surface/70">
              <td className="px-4 py-4">
                <Link
                  href={`/admin/elections/${election.id}`}
                  className="block whitespace-normal break-words font-bold leading-6 text-brand-700 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-700 [word-break:keep-all]"
                >
                  {election.title}
                </Link>
                <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-ink-faint [word-break:keep-all]">
                  {election.description ?? "설명 없음"}
                </p>
              </td>
              <td className="whitespace-normal px-3 py-4 [word-break:keep-all]">
                <StatusBadge status={election.state as ElectionStateValue} size="sm" />
              </td>
              <td className="whitespace-normal px-3 py-4 leading-6 [overflow-wrap:break-word] [word-break:keep-all]">
                {labelOf(electionTypeShortLabelMap, election.electionType)}
              </td>
              <td className="whitespace-normal px-3 py-4 text-ink-muted [word-break:keep-all]">
                <dl className="grid gap-1 leading-6">
                  <div className="grid grid-cols-[2.25rem_1fr] gap-1.5">
                    <dt className="font-bold text-ink-faint">시작</dt>
                    <dd>{formatDate(election.startsAt)}</dd>
                  </div>
                  <div className="grid grid-cols-[2.25rem_1fr] gap-1.5">
                    <dt className="font-bold text-ink-faint">종료</dt>
                    <dd>{formatDate(election.endsAt)}</dd>
                  </div>
                </dl>
              </td>
              <td className="whitespace-normal px-3 py-4 text-center [word-break:keep-all]">{election.eligibleVoterCount}</td>
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
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
      </div>
      {elections.length > 0 ? (
        <AdminElectionTable elections={elections} />
      ) : (
        <div className="rounded-card border border-dashed border-line-input bg-white px-4 py-5 text-sm text-ink-muted">
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
        description="마감, 집계, 확정, 공개, 보관 또는 무효 처리된 투표입니다. 취소된 투표도 무효 상태로 이력에 남습니다."
        elections={completed}
        emptyMessage="완료된 투표가 없습니다."
      />
    </div>
  );
}
