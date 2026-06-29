import { notFound } from "next/navigation";

import { FormSection } from "../../../../../../components/admin/admin-cards";
import { VoterRegistryImportForm } from "../../../../../../components/admin/admin-election-forms";
import { AnonymousVotingNotice } from "../../../../../../components/ui/anonymous-voting-notice";
import { PageHeader } from "../../../../../../components/ui/page-header";
import { PrivacyNotice } from "../../../../../../components/ui/privacy-notice";
import { WarningBanner } from "../../../../../../components/ui/warning-banner";
import { ElectionState } from "../../../../../../guardrails/index.js";
import { getCurrentAdminSessionFromCookies } from "../../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../../server/db/prisma";
import { getAdminElectionDetail } from "../../../../../../server/elections/admin-election-view";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export default async function AdminVotersPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const election = await getAdminElectionDetail(getPrismaClient(), restored.session, (await params).election_id);
  if (!election) notFound();
  const disabled = election.state !== ElectionState.DRAFT;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="명부 관리"
        title="유권자 명부 등록/검증"
        description="Election별 독립 명부를 검증하고 확정합니다."
        status={election.state}
      />
      <PrivacyNotice />
      <AnonymousVotingNotice audience="admin" />
      <FormSection title="명부 업로드" description="MVP 기본 식별자는 이름 + 조직 내 외부 식별자입니다.">
        <VoterRegistryImportForm electionId={election.id} disabled={disabled} />
      </FormSection>
      <section className="rounded-md border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">현재 명부 요약</h2>
        <p className="mt-2 text-slate-600">
          {election.voterRegistry
            ? `${election.voterRegistry.status}: ${election.voterRegistry.validRows}/${election.voterRegistry.totalRows} valid`
            : "아직 등록된 명부가 없습니다."}
        </p>
      </section>
      <WarningBanner title="노출 제한">
        참여 현황은 미참여, 참여 완료, 인증 문제 있음, 초대 발송 실패 수준으로만 표시합니다.
      </WarningBanner>
    </div>
  );
}
