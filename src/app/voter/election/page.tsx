import { AnonymousVotingNotice } from "../../../components/ui/anonymous-voting-notice";
import { ErrorState } from "../../../components/ui/error-state";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { VoterSecondaryLink, VoterShell } from "../../../components/voter/voter-shell";
import { getCurrentVoterElectionInfo } from "../../../server/voters/voter-ui-data";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

export default async function VoterElectionPage() {
  const { data: election, error } = await getCurrentVoterElectionInfo();
  if (!election) {
    return (
      <VoterShell>
        <ErrorState title="투표 정보를 확인할 수 없습니다" description={error ?? "초대 확인부터 다시 진행해 주세요."} />
        <VoterSecondaryLink href="/voter/invite">초대 확인으로 이동</VoterSecondaryLink>
      </VoterShell>
    );
  }

  return (
    <VoterShell>
      <PageHeader
        eyebrow="투표 정보"
        title={election.title}
        description={election.description ?? undefined}
        status={election.state}
      />
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">상태</span>
          <StatusBadge status={election.state} size="sm" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">마감</span>
          <span className="font-medium">{formatDate(election.ends_at)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">방식</span>
          <span className="font-medium">{election.voting_mode === "anonymous" ? "익명투표" : "기명투표"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">문항 수</span>
          <span className="font-medium">{election.questions.length}</span>
        </div>
      </section>
      {election.voting_mode === "anonymous" ? <AnonymousVotingNotice audience="voter" /> : null}
      <VoterSecondaryLink href="/voter/ballot">투표 시작</VoterSecondaryLink>
    </VoterShell>
  );
}
