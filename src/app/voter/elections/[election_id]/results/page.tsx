import { ErrorState } from "../../../../../components/ui/error-state";
import { PageHeader } from "../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../components/ui/warning-banner";
import { VoterSecondaryLink, VoterShell } from "../../../../../components/voter/voter-shell";
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

  return (
    <VoterShell>
      <PageHeader
        eyebrow="결과 열람"
        title="공개된 결과"
        description="관리자 확정과 공개 이후 열람할 수 있습니다."
      />
      <WarningBanner title="소규모 익명투표 제한">
        재식별 위험이 있는 세부 득표수는 제한되거나 마스킹될 수 있습니다.
      </WarningBanner>
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        {data.result.items.map((item, index) => (
          <div key={`${item.display_label ?? "item"}-${index}`} className="flex items-center justify-between">
            <span className="font-medium">{item.display_label ?? "결과 항목"}</span>
            <span className="text-sm text-slate-700">
              {item.masked ? "소규모 제한" : item.vote_count === undefined ? "공개 제한" : `${item.vote_count}표`}
            </span>
          </div>
        ))}
      </section>
    </VoterShell>
  );
}
