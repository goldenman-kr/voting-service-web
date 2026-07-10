import { PageHeader } from "../../../components/ui/page-header";
import { VoterIdentifierNotice } from "../../../components/ui/voter-identifier-notice";
import { VoterIdentifierForm } from "../../../components/voter/voter-auth-forms";
import { VoterShell } from "../../../components/voter/voter-shell";

export default function VoterIdentifyPage() {
  return (
    <VoterShell step={1}>
      <PageHeader
        eyebrow="유권자 확인"
        title="이름과 조직 내 식별번호를 입력해 주세요"
        description="MVP 기본 인증은 초대 링크와 유권자 식별자 확인입니다."
      />
      <VoterIdentifierForm />
      <VoterIdentifierNotice />
    </VoterShell>
  );
}
