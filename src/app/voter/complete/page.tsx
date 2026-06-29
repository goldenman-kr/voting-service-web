import { PageHeader } from "../../../components/ui/page-header";
import { AnonymousVotingNotice } from "../../../components/ui/anonymous-voting-notice";
import { ErrorState } from "../../../components/ui/error-state";
import { VoterSecondaryLink, VoterShell } from "../../../components/voter/voter-shell";
import { getCurrentVoterCompletionStatus } from "../../../server/voters/voter-ui-data";

function formatDate(value?: string): string {
  if (!value) return "접수 기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

export default async function VoterCompletePage() {
  const { data: completion, error } = await getCurrentVoterCompletionStatus();
  if (!completion) {
    return (
      <VoterShell>
        <ErrorState title="완료 상태를 확인할 수 없습니다" description={error ?? "초대 확인부터 다시 진행해 주세요."} />
        <VoterSecondaryLink href="/voter/invite">초대 확인으로 이동</VoterSecondaryLink>
      </VoterShell>
    );
  }

  return (
    <VoterShell>
      <PageHeader
        eyebrow="투표 완료"
        title="투표가 접수되었습니다"
        description="완료 여부와 확인용 일부 정보만 표시합니다."
      />
      <section className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <div className="flex items-center justify-between">
          <span className="text-sm">완료 여부</span>
          <span className="font-semibold">{completion.completed ? "참여 완료" : "미완료"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">마지막 제출</span>
          <span className="font-semibold">{formatDate(completion.last_submitted_at)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">확인 정보</span>
          <span className="font-semibold">{completion.receipt_preview ?? "제한 표시"}</span>
        </div>
      </section>
      <AnonymousVotingNotice audience="voter" />
      <VoterSecondaryLink href="/voter/ballot">마감 전 다시 투표</VoterSecondaryLink>
      <VoterSecondaryLink href="/voter/results">결과 보기</VoterSecondaryLink>
    </VoterShell>
  );
}
