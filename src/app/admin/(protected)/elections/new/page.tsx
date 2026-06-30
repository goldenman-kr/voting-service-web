import { CreateElectionWizardForm } from "../../../../../components/admin/admin-election-forms";
import { PageHeader } from "../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../components/ui/warning-banner";
import { AnonymousVotingNotice } from "../../../../../components/ui/anonymous-voting-notice";

export default function NewElectionPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="투표 생성"
        title="새 투표 만들기"
        description="기본 정보, 문항과 선택 항목, 선거인 명부를 3단계로 나누어 입력합니다."
      />
      <WarningBanner title="시작 후 수정 제한">
        투표가 시작되면 문항과 명부 수정이 제한됩니다. 공개된 결과는 직접 덮어쓰지 않고 정정 또는 무효
        절차로만 처리합니다.
      </WarningBanner>
      <CreateElectionWizardForm />
      <AnonymousVotingNotice audience="admin" />
    </div>
  );
}
