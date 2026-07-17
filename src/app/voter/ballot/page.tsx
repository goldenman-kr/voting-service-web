import { ErrorState } from "../../../components/ui/error-state";
import { PageHeader } from "../../../components/ui/page-header";
import { WarningBanner } from "../../../components/ui/warning-banner";
import { VoterBallotForm } from "../../../components/voter/voter-ballot-flow";
import { VoterSecondaryLink, VoterShell } from "../../../components/voter/voter-shell";
import {
  getCurrentVoterCompletionStatus,
  getCurrentVoterElectionInfo
} from "../../../server/voters/voter-ui-data";

export default async function VoterBallotPage() {
  const [{ data: election, error }, { data: completion }] = await Promise.all([
    getCurrentVoterElectionInfo(),
    getCurrentVoterCompletionStatus()
  ]);
  if (!election) {
    return (
      <VoterShell step={2}>
        <ErrorState title="투표 화면을 열 수 없습니다" description={error ?? "초대 확인부터 다시 진행해 주세요."} />
        <VoterSecondaryLink href="/voter/invite">초대 확인으로 이동</VoterSecondaryLink>
      </VoterShell>
    );
  }
  if (!election.voting_open) {
    return (
      <VoterShell step={2}>
        <PageHeader eyebrow="투표 종료" title={election.title} status={election.state} />
        <WarningBanner title="관리자 결과 처리 대기 중">
          투표가 종료되어 더 이상 참여할 수 없습니다.
        </WarningBanner>
        <VoterSecondaryLink href="/voter">투표 목록으로 이동</VoterSecondaryLink>
      </VoterShell>
    );
  }

  return (
    <VoterShell step={2}>
      <PageHeader
        eyebrow="투표 입력"
        title={election.title}
        description="선택 후 제출 전 확인 화면에서 한 번 더 확인합니다."
        status={election.state}
      />
      <VoterBallotForm election={election} completion={completion} />
    </VoterShell>
  );
}
