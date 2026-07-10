import { ErrorState } from "../../../components/ui/error-state";
import { PageHeader } from "../../../components/ui/page-header";
import { VoterSecondaryLink, VoterShell } from "../../../components/voter/voter-shell";
import {
  formatPercent,
  formatResultVoteCount,
  resultItemVoteDenominators
} from "../../../lib/ui/result-percentages";
import { getCurrentVoterResult } from "../../../server/voters/voter-ui-data";

export default async function VoterResultsPage() {
  const { data, error } = await getCurrentVoterResult();
  if (!data) {
    return (
      <VoterShell>
        <PageHeader
          eyebrow="결과 열람"
          title="아직 결과를 볼 수 없습니다"
          description="관리자 확정과 공개 이후 열람할 수 있습니다."
        />
        <ErrorState title="결과 비공개" description={error ?? "현재 공개된 결과가 없습니다."} />
        <VoterSecondaryLink href="/voter/complete">완료 상태로 이동</VoterSecondaryLink>
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
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <h2 className="font-semibold">결과 공지</h2>
          <p className="mt-1 whitespace-pre-wrap">{resultNotice}</p>
        </section>
      ) : null}
      <section className="grid gap-2 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">투표율</h2>
        <p className="text-2xl font-semibold text-slate-950">
          {formatPercent(actualVoteCount, eligibleVoterCount)}
        </p>
        <p className="text-sm text-slate-600">
          총 유권자 {eligibleVoterCount}명 중 {actualVoteCount}명 투표
        </p>
      </section>
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        {data.result.items.map((item, index) => (
          <div key={`${item.display_label ?? "item"}-${index}`} className="flex items-center justify-between">
            <span className="font-medium">{item.display_label ?? "결과 항목"}</span>
            <span className="text-sm text-slate-700">
              {formatResultVoteCount(item, voteDenominators)}
            </span>
          </div>
        ))}
      </section>
      {data.result.privacy_risk_level ? (
        <p className="text-xs text-slate-500">공개 위험도: {data.result.privacy_risk_level}</p>
      ) : null}
    </VoterShell>
  );
}
