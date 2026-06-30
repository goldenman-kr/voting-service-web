import { CreateManagedVoterRegistryForm } from "../../../../../components/admin/managed-voter-registry-forms";
import { PageHeader } from "../../../../../components/ui/page-header";

export default function NewManagedVoterRegistryPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="선거인명부 관리"
        title="새 명부 만들기"
        description="투표 생성 wizard와 분리된 독립 선거인명부를 만듭니다."
      />
      <CreateManagedVoterRegistryForm />
    </div>
  );
}
