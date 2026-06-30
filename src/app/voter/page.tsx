import { PageHeader } from "../../components/ui/page-header";
import { PrivacyNotice } from "../../components/ui/privacy-notice";
import { VoterSecondaryLink, VoterShell } from "../../components/voter/voter-shell";

export default function VoterDashboardPage() {
  return (
    <VoterShell>
      <PageHeader
        eyebrow="투표하러가기"
        title="초대받은 투표를 안전하게 시작합니다"
        description="현재 MVP는 공개 투표 목록이 아니라 초대 확인을 먼저 거치는 방식입니다. 초대값은 화면 주소에 계속 남기지 않고 서버 세션으로 교환합니다."
      />

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">진행 순서</h2>
        <ol className="grid gap-3 text-sm leading-6 text-slate-700">
          <li>
            <span className="font-semibold text-slate-950">1. 초대 확인</span>
            <br />
            안내받은 초대 정보로 참여 가능한 투표인지 확인합니다.
          </li>
          <li>
            <span className="font-semibold text-slate-950">2. 선거인 명부 인증</span>
            <br />
            이름과 조직 내 식별자로 명부에 등록된 대상자인지 확인합니다.
          </li>
          <li>
            <span className="font-semibold text-slate-950">3. 투표 정보 확인 후 제출</span>
            <br />
            투표 방식, 마감 시각, 재투표 허용 여부를 확인한 뒤 선택을 제출합니다.
          </li>
        </ol>
      </section>

      <section className="rounded-md border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
        현재 시스템은 마감 전 재투표를 지원할 수 있습니다. “제출 후 수정 불가” 정책은 별도 정책 변경과
        검증이 필요하므로, 각 투표 화면에 표시되는 정책 안내를 확인해 주세요.
      </section>

      <VoterSecondaryLink href="/voter/invite">초대 확인 시작</VoterSecondaryLink>
      <PrivacyNotice compact />
    </VoterShell>
  );
}
