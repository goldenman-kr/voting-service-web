import { ErrorState } from "../../../../../components/ui/error-state";
import { PageHeader } from "../../../../../components/ui/page-header";
import { VoterSecondaryLink, VoterShell } from "../../../../../components/voter/voter-shell";
import {
  formatPercent,
  formatResultVoteCount,
  resultItemVoteDenominators
} from "../../../../../lib/ui/result-percentages";
import {
  getCurrentVoterElectionInfo,
  getCurrentVoterResult
} from "../../../../../server/voters/voter-ui-data";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export default async function ListedVoterResultsPage({ params }: Params) {
  const electionId = (await params).election_id;
  const election = await getCurrentVoterElectionInfo();
  const { data, error } = await getCurrentVoterResult();
  if (!election.data || election.data.election_id !== electionId || !data) {
    return (
      <VoterShell>
        <PageHeader
          eyebrow="결과 열람"
          title="아직 결과를 볼 수 없습니다"
          description="선거인 확인과 결과 공개 이후 열람할 수 있습니다."
        />
        <ErrorState title="결과 비공개" description={error ?? "현재 공개된 결과가 없습니다."} />
        <VoterSecondaryLink href={`/voter/elections/${electionId}/verify`}>선거인 확인으로 이동</VoterSecondaryLink>
      </VoterShell>
    );
  }
  const resultNotice = data.result_version.notice?.trim();
  const eligibleVoterCount = data.result.turnout?.eligible_voter_count ?? 0;
  const actualVoteCount = data.result.turnout?.actual_vote_count ?? 0;
  const voteDenominators = resultItemVoteDenominators(data.result.items);

  return (
    <VoterShell>
      <PageHeader
        eyebrow="결과 열람"
        title="공개된 결과"
        description="관리자 확정과 공개 이후 열람할 수 있습니다."
      />
      {resultNotice ? (
        <section className="rounded-[14px] border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-ink-body">
          <h2 className="font-bold text-brand-800">결과 공지</h2>
          <p className="mt-1 whitespace-pre-wrap">{resultNotice}</p>
        </section>
      ) : null}
      <section className="ui-card grid gap-2 p-5">
        <h2 className="text-base font-bold text-ink">투표율</h2>
        <p className="text-[28px] font-extrabold text-ink">
          {formatPercent(actualVoteCount, eligibleVoterCount)}
        </p>
        <p className="text-sm text-ink-muted">
          총 유권자 {eligibleVoterCount}명 중 {actualVoteCount}명 투표
        </p>
      </section>
      <section className="ui-card grid gap-3 p-5">
        {data.result.items.map((item, index) => (
          <div key={`${item.display_label ?? "item"}-${index}`} className="flex items-center justify-between">
            <span className="font-semibold text-ink">{item.display_label ?? "결과 항목"}</span>
            <span className="text-sm text-ink-body">
              {formatResultVoteCount(item, voteDenominators)}
            </span>
          </div>
        ))}
      </section>
    </VoterShell>
  );
}
