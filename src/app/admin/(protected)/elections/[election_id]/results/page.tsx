import { notFound } from "next/navigation";
import { BallotAcceptanceStatus } from "@prisma/client";

import {
  ReportExportSkeleton,
  ResultOperationPanel
} from "../../../../../../components/admin/admin-operation-forms";
import { StateHistoryTable, type StateHistoryTableRow } from "../../../../../../components/admin/state-history-table";
import { EmptyState } from "../../../../../../components/ui/empty-state";
import { ErrorState } from "../../../../../../components/ui/error-state";
import { PageHeader } from "../../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../../components/ui/warning-banner";
import {
  formatPercent,
  formatResultVoteCount,
  resultItemVoteDenominators
} from "../../../../../../lib/ui/result-percentages";
import { ElectionState } from "../../../../../../guardrails/index.js";
import type { ElectionStateValue } from "../../../../../../domain/elections/state-machine";
import { getCurrentAdminSessionFromCookies } from "../../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../../server/db/prisma";
import { getAdminElectionDetail } from "../../../../../../server/elections/admin-election-view";
import { getAdminResultView } from "../../../../../../server/results/admin-actions";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

type ResultItem = Readonly<{
  question_id?: string | null;
  option_id?: string | null;
  display_label?: string;
  masked?: boolean;
  vote_count?: number;
}>;

const resultStateHistoryLabels: Record<string, string> = {
  result_tally_started: "결과 집계 시작",
  result_tally_completed: "집계 완료",
  result_confirmed: "결과 확정",
  result_published: "결과 공개",
  election_invalidated: "무효 처리"
};

const resultStateHistoryChangeTypes = Object.keys(resultStateHistoryLabels);

function resultItems(data: unknown): ResultItem[] {
  if (!data || typeof data !== "object") return [];
  const result = (data as { result?: { items?: unknown } }).result;
  if (!result || !Array.isArray(result.items)) return [];
  return result.items.filter((item): item is ResultItem => Boolean(item && typeof item === "object"));
}

const resultDisplayStates = new Set<ElectionStateValue>([
  ElectionState.CLOSED,
  ElectionState.TALLYING,
  ElectionState.PENDING_CONFIRMATION,
  ElectionState.CONFIRMED,
  ElectionState.PUBLISHED,
  ElectionState.INVALIDATED
]);

async function countLiveActualVotes(electionId: string): Promise<number> {
  return getPrismaClient().ballot.count({
    where: {
      electionId,
      isCurrent: true,
      acceptanceStatus: BallotAcceptanceStatus.accepted,
      serverReceivedAt: { lte: new Date() }
    }
  });
}

export default async function AdminResultsPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const electionId = (await params).election_id;
  const election = await getAdminElectionDetail(getPrismaClient(), restored.session, electionId);
  if (!election) notFound();
  const hasEnded = election.endsAt <= new Date() || resultDisplayStates.has(election.state);

  if (!hasEnded) {
    const actualVoteCount = await countLiveActualVotes(election.id);
    return (
      <div className="grid gap-6">
        <PageHeader
          eyebrow="결과 관리"
          title={`${election.title} 결과`}
          status={election.state}
        />
        <section className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-700">투표가 종료되지 않아 투표율만 표시됩니다.</p>
        </section>
        <section className="grid gap-2 rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-950">실시간 투표율</h2>
          <p className="text-2xl font-semibold text-slate-950">
            {formatPercent(actualVoteCount, election.eligibleVoterCount)}
          </p>
          <p className="text-sm text-slate-600">
            총 유권자 {election.eligibleVoterCount}명 중 {actualVoteCount}명 투표
          </p>
        </section>
      </div>
    );
  }

  const resultView = await getAdminResultView(election.id);
  const resultStateHistories = await getPrismaClient().electionStateHistory.findMany({
    where: {
      electionId: election.id,
      election: { organizationId: restored.session.organizationId, deletedAt: null },
      changeType: { in: resultStateHistoryChangeTypes }
    },
    orderBy: { changedAt: "asc" },
    select: { changeType: true, changedAt: true }
  });
  const resultStateHistoryRows: StateHistoryTableRow[] = resultStateHistories.map((history) => ({
    label: resultStateHistoryLabels[history.changeType] ?? history.changeType,
    changedAt: history.changedAt
  }));
  const rows = resultItems(resultView.data);
  const result = resultView.data && typeof resultView.data === "object"
    ? (resultView.data as { result?: { turnout?: { eligible_voter_count?: number | null; actual_vote_count?: number | null } } }).result
    : undefined;
  const eligibleVoterCount = result?.turnout?.eligible_voter_count ?? 0;
  const actualVoteCount = result?.turnout?.actual_vote_count ?? 0;
  const voteDenominators = resultItemVoteDenominators(rows);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="결과 관리"
        title={`${election.title} 결과`}
        description="결과는 집계 단위로만 표시하며 공개 이후 덮어쓰지 않습니다."
        status={election.state}
      />
      <WarningBanner title="결과 공개 이후 정책">
        공개된 결과는 조용히 수정하거나 삭제하지 않습니다. 정정은 새 버전과 공지로 처리하고, 중대한 오류는 무효 기록으로 남깁니다.
      </WarningBanner>
      <section className="grid gap-2 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">투표율</h2>
        <p className="text-2xl font-semibold text-slate-950">
          {formatPercent(actualVoteCount, eligibleVoterCount)}
        </p>
        <p className="text-sm text-slate-600">
          총 유권자 {eligibleVoterCount}명 중 {actualVoteCount}명 투표
        </p>
      </section>
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">집계 결과</h2>
        {resultView.error ? (
          <ErrorState title="결과를 아직 표시할 수 없습니다" description={resultView.error} />
        ) : rows.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {rows.map((row, index) => (
              <div key={`${row.display_label ?? "item"}-${index}`} className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3">
                <span className="font-medium">{row.display_label ?? "항목"}</span>
                <span className="text-sm text-slate-700">
                  {formatResultVoteCount(row, voteDenominators)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="아직 집계 결과가 없습니다" description="종료 이후 결과 집계를 실행하면 집계 단위 결과가 표시됩니다." />
        )}
      </section>
      <ResultOperationPanel electionId={election.id} state={election.state} />
      <StateHistoryTable
        title="결과 상태 변경 이력"
        rows={resultStateHistoryRows}
        emptyMessage="표시할 결과 상태 변경 이력이 없습니다."
      />
      <ReportExportSkeleton />
    </div>
  );
}
