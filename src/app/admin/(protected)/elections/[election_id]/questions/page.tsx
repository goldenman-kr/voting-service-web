import { notFound } from "next/navigation";

import { FormSection } from "../../../../../../components/admin/admin-cards";
import { QuestionOptionForm } from "../../../../../../components/admin/admin-election-forms";
import { PageHeader } from "../../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../../components/ui/warning-banner";
import { ElectionState } from "../../../../../../guardrails/index.js";
import { getCurrentAdminSessionFromCookies } from "../../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../../server/db/prisma";
import { getAdminElectionDetail } from "../../../../../../server/elections/admin-election-view";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export default async function AdminQuestionsPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const election = await getAdminElectionDetail(getPrismaClient(), restored.session, (await params).election_id);
  if (!election) notFound();
  const disabled = election.state !== ElectionState.DRAFT;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="문항 설정"
        title="문항/선택 항목"
        description="시작 전 검수 단계에서 문항과 선택 항목을 확인합니다."
        status={election.state}
      />
      <WarningBanner>
        시작된 투표의 문항과 선택 항목은 직접 수정하지 않습니다. 오류 발견 시 중단, 무효, 재실시 정책을 사용합니다.
      </WarningBanner>
      <FormSection title="문항 추가" description="MVP에서는 단일/복수 선택과 찬반 문항을 우선 지원합니다.">
        <QuestionOptionForm electionId={election.id} disabled={disabled} />
      </FormSection>
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">현재 문항</h2>
        <div className="mt-4 grid gap-3">
          {election.questions.map((question) => (
            <div key={question.id} className="rounded-md border border-slate-200 p-4">
              <p className="font-medium">{question.title}</p>
              <p className="mt-1 text-xs text-slate-500">{question.questionType}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {question.options.map((option) => (
                  <span key={option.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                    {option.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
