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
      <VoterShell step={4}>
        <ErrorState title="완료 상태를 확인할 수 없습니다" description={error ?? "초대 확인부터 다시 진행해 주세요."} />
        <VoterSecondaryLink href="/voter/invite">초대 확인으로 이동</VoterSecondaryLink>
      </VoterShell>
    );
  }

  return (
    <VoterShell step={4}>
      <header className="py-2 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#E9F6EF] text-[#1F7A4D] ring-8 ring-[#E9F6EF]/50">
          <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
        </span>
        <p className="ui-eyebrow mt-6">투표 완료</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.025em] text-ink">투표가 접수되었습니다</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">완료 여부와 확인용 일부 정보만 표시합니다.</p>
      </header>
      <section className="ui-card grid gap-4 p-5 text-ink-soft">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">완료 여부</span>
          <span className="font-bold text-[#1F7A4D]">{completion.completed ? "참여 완료" : "미완료"}</span>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm text-ink-muted">마지막 제출 시각</span>
          <span className="font-bold">{formatDate(completion.last_submitted_at)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm text-ink-muted">확인 정보</span>
          <span className="font-bold">{completion.receipt_preview ?? "제한 표시"}</span>
        </div>
      </section>
      <VoterSecondaryLink href="/voter/results">결과 보기</VoterSecondaryLink>
    </VoterShell>
  );
}
