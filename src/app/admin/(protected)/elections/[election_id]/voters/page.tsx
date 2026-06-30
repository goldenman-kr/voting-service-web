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
import {
  getAdminElectionDetail,
  listAdminEligibleVoterRows
} from "../../../../../../server/elections/admin-election-view";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export default async function AdminVotersPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const prisma = getPrismaClient();
  const election = await getAdminElectionDetail(prisma, restored.session, (await params).election_id);
  if (!election) notFound();
  const voters = await listAdminEligibleVoterRows(prisma, restored.session, election.id);
  const disabled = election.state !== ElectionState.DRAFT;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="명부 관리"
        title="선거인 명부 등록/검증"
        description="투표별 독립 명부를 검증하고 확정합니다."
        status={election.state}
      />
      <PrivacyNotice />
      <AnonymousVotingNotice audience="admin" />
      <FormSection
        title="명부 등록/검증"
        description="호수번호, 이름, 식별번호, 생년월일을 입력하거나 CSV/XLSX 파일에서 불러온 뒤 확인하고 저장합니다."
      >
        <VoterRegistryImportForm electionId={election.id} disabled={disabled} />
      </FormSection>
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-semibold text-slate-950">유효한 선거인 목록</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            투표 내용과 연결되는 내부 식별자는 표시하지 않습니다.
          </p>
        </div>
        {voters.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-normal text-slate-600">
                <tr>
                  <th className="px-4 py-3">호수번호</th>
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">식별번호</th>
                  <th className="px-4 py-3">생년월일</th>
                  <th className="px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {voters.map((voter, index) => (
                  <tr key={`${voter.createdAt.toISOString()}-${index}`}>
                    <td className="px-4 py-3">{voter.householdNumber}</td>
                    <td className="px-4 py-3">{voter.name}</td>
                    <td className="px-4 py-3">{voter.identifierLast4}</td>
                    <td className="px-4 py-3">{voter.birthDate6}</td>
                    <td className="px-4 py-3">{voter.status === "active" ? "활성" : "제한됨"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            아직 표시할 유효한 선거인이 없습니다.
          </p>
        )}
      </section>
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
