import { ErrorState } from "../../../components/ui/error-state";
import { PageHeader } from "../../../components/ui/page-header";
import { WarningBanner } from "../../../components/ui/warning-banner";
import { VoterReviewSubmit } from "../../../components/voter/voter-ballot-flow";
import { VoterSecondaryLink, VoterShell } from "../../../components/voter/voter-shell";
import {
  getCurrentVoterCompletionStatus,
  getCurrentVoterElectionInfo
} from "../../../server/voters/voter-ui-data";

export default async function VoterReviewPage() {
  const [{ data: election, error }, { data: completion }] = await Promise.all([
    getCurrentVoterElectionInfo(),
    getCurrentVoterCompletionStatus()
  ]);
  if (!election) {
    return (
      <VoterShell>
        <ErrorState title="제출 전 확인을 열 수 없습니다" description={error ?? "투표 정보를 다시 확인해 주세요."} />
        <VoterSecondaryLink href="/voter/election">투표 정보로 이동</VoterSecondaryLink>
      </VoterShell>
    );
  }

  return (
    <VoterShell>
      <PageHeader
        eyebrow="제출 전 확인"
        title="제출 후에는 투표참여가 완료되며 다시 수정할 수 없습니다."
        description="제출 전 선택 내용을 마지막으로 확인해 주세요."
      />
      <WarningBanner title="익명투표 제출 안내">
        제출 후 완료 여부와 제한된 확인 정보만 표시합니다. 이전 선택 내용은 다시 표시하지 않습니다.
      </WarningBanner>
      <VoterReviewSubmit election={election} isRevote={Boolean(completion?.completed)} />
    </VoterShell>
  );
}
