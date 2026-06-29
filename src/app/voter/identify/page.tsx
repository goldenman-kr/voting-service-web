import { PageHeader } from "../../../components/ui/page-header";
import { PrivacyNotice } from "../../../components/ui/privacy-notice";
import { VoterIdentifierForm } from "../../../components/voter/voter-auth-forms";
import { VoterShell } from "../../../components/voter/voter-shell";

export default function VoterIdentifyPage() {
  return (
    <VoterShell>
      <PageHeader
        eyebrow="유권자 확인"
        title="이름과 조직 내 식별번호를 입력해 주세요"
        description="MVP 기본 인증은 초대 링크와 유권자 식별자 확인입니다."
      />
      <VoterIdentifierForm />
      <PrivacyNotice compact />
      <p className="text-sm leading-6 text-slate-600">5회 실패 시 15분 동안 다시 시도할 수 없습니다.</p>
    </VoterShell>
  );
}
