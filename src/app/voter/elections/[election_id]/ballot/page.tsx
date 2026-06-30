import { AnonymousVotingNotice } from "../../../../../components/ui/anonymous-voting-notice";
import { ErrorState } from "../../../../../components/ui/error-state";
import { PageHeader } from "../../../../../components/ui/page-header";
import { VoterBallotForm } from "../../../../../components/voter/voter-ballot-flow";
import { VoterSecondaryLink, VoterShell } from "../../../../../components/voter/voter-shell";
import {
  getCurrentVoterCompletionStatus,
  getCurrentVoterElectionInfo
} from "../../../../../server/voters/voter-ui-data";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export default async function ListedVoterBallotPage({ params }: Params) {
  const electionId = (await params).election_id;
  const [{ data: election, error }, { data: completion }] = await Promise.all([
    getCurrentVoterElectionInfo(),
    getCurrentVoterCompletionStatus()
  ]);
  if (!election || election.election_id !== electionId) {
    return (
      <VoterShell>
        <ErrorState title="투표 화면을 열 수 없습니다" description={error ?? "선거인 확인부터 다시 진행해 주세요."} />
        <VoterSecondaryLink href={`/voter/elections/${electionId}/verify`}>선거인 확인으로 이동</VoterSecondaryLink>
      </VoterShell>
    );
  }

  return (
    <VoterShell>
      <PageHeader
        eyebrow="투표 입력"
        title={election.title}
        description="선택 후 제출 전 확인 화면에서 한 번 더 확인합니다."
        status={election.state}
      />
      {election.voting_mode === "anonymous" ? <AnonymousVotingNotice audience="voter" /> : null}
      <VoterBallotForm election={election} completion={completion} />
    </VoterShell>
  );
}
