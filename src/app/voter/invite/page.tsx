import { PageHeader } from "../../../components/ui/page-header";
import { PrivacyNotice } from "../../../components/ui/privacy-notice";
import { VoterInviteExchangeForm } from "../../../components/voter/voter-auth-forms";
import { VoterShell } from "../../../components/voter/voter-shell";

export default function VoterInvitePage() {
  return (
    <VoterShell>
      <PageHeader
        eyebrow="초대 확인"
        title="초대받은 유권자만 참여할 수 있습니다"
        description="초대 링크는 서버에서 짧은 세션으로 교환되며 민감한 값은 화면에 표시하지 않습니다."
      />
      <VoterInviteExchangeForm />
      <PrivacyNotice compact />
    </VoterShell>
  );
}
