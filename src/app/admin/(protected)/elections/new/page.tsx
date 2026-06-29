import { FormSection } from "../../../../../components/admin/admin-cards";
import { CreateElectionForm } from "../../../../../components/admin/admin-election-forms";
import { PageHeader } from "../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../components/ui/warning-banner";
import { AnonymousVotingNotice } from "../../../../../components/ui/anonymous-voting-notice";

export default function NewElectionPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="투표 생성"
        title="새 투표 초안"
        description="초안 상태에서만 기본 정보, 문항, 명부를 자유롭게 수정할 수 있습니다."
      />
      <WarningBanner title="시작 후 수정 제한">
        투표가 시작되면 직접 수정 대신 중단, 무효, 정정 절차를 사용합니다.
      </WarningBanner>
      <FormSection title="기본 정보와 일정" description="생성 시 기본 AuthenticationPolicy는 invite_link_with_identifier로 저장됩니다.">
        <CreateElectionForm />
      </FormSection>
      <AnonymousVotingNotice audience="admin" />
    </div>
  );
}
