import { notFound } from "next/navigation";

import { AuthenticationPolicyForm } from "../../../../../../components/admin/admin-election-forms";
import { AuthenticationMethod } from "../../../../../../guardrails/index.js";
import { PageHeader } from "../../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../../components/ui/warning-banner";
import { getCurrentAdminSessionFromCookies } from "../../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../../server/db/prisma";
import { getAdminElectionDetail } from "../../../../../../server/elections/admin-election-view";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

const codeMethods = new Set<string>([
  AuthenticationMethod.EMAIL_CODE,
  AuthenticationMethod.SMS_CODE,
  AuthenticationMethod.KAKAO_MESSAGE
]);

export default async function AdminAuthPolicyPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const election = await getAdminElectionDetail(getPrismaClient(), restored.session, (await params).election_id);
  if (!election) notFound();
  const selectedMethod = election.authenticationPolicy?.method ?? AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER;
  const showCodeSettings = codeMethods.has(selectedMethod);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="투표 참여 인증 방식"
        title="투표 참여 인증 방식 설정"
        description="MVP 기본값은 초대 링크 + 유권자 식별자 확인입니다. 1회성 코드는 투표별 선택 옵션입니다."
        status={election.state}
      />
      <AuthenticationPolicyForm
        electionId={election.id}
        currentMethod={selectedMethod}
        disabled={election.state !== "draft"}
      />
      {showCodeSettings ? (
        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold">코드 인증 설정</h2>
          <p className="mt-2 text-sm text-slate-600">재발송 제한, 만료, 실패 잠금 설정은 코드 방식에서만 표시됩니다.</p>
        </section>
      ) : (
        <WarningBanner title="코드 인증 비활성">
          현재 선택된 MVP 기본 인증에서는 인증코드 재발송, 만료, 코드 실패 잠금 설정을 표시하지 않습니다.
        </WarningBanner>
      )}
    </div>
  );
}
