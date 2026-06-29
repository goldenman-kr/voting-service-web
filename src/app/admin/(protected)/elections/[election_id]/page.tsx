import Link from "next/link";
import { notFound } from "next/navigation";

import { MetricCard } from "../../../../../components/admin/admin-cards";
import { RequestReviewForm } from "../../../../../components/admin/admin-election-forms";
import { ElectionStateCtaPanel } from "../../../../../components/admin/admin-operation-forms";
import { StepUpPanel } from "../../../../../components/admin/step-up-panel";
import { AnonymousVotingNotice } from "../../../../../components/ui/anonymous-voting-notice";
import { AuditNotice } from "../../../../../components/ui/audit-notice";
import { PageHeader } from "../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../components/ui/warning-banner";
import { ElectionState } from "../../../../../guardrails/index.js";
import { getCurrentAdminSessionFromCookies } from "../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../server/db/prisma";
import { getAdminElectionDetail } from "../../../../../server/elections/admin-election-view";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

export default async function AdminElectionDetailPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const election = await getAdminElectionDetail(getPrismaClient(), restored.session, (await params).election_id);
  if (!election) notFound();
  const canRequestReview = election.state === ElectionState.DRAFT;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="투표 상세"
        title={election.title}
        description={election.description ?? undefined}
        status={election.state}
      />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="유권자" value={election.eligibleVoterCount} />
        <MetricCard label="문항" value={election.questionCount} />
        <MetricCard label="인증 정책" value={election.authenticationPolicy?.method ?? "기본값 미설정"} />
      </section>
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">설정 요약</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">투표 유형</dt><dd>{election.electionType}</dd></div>
          <div><dt className="font-semibold text-slate-500">투표 방식</dt><dd>{election.votingMode === "anonymous" ? "익명" : "기명"}</dd></div>
          <div><dt className="font-semibold text-slate-500">명부</dt><dd>{election.voterRegistry ? `${election.voterRegistry.validRows}/${election.voterRegistry.totalRows} valid` : "미등록"}</dd></div>
          <div><dt className="font-semibold text-slate-500">AuthenticationPolicy</dt><dd>{election.authenticationPolicy?.method ?? "invite_link_with_identifier"}</dd></div>
        </dl>
      </section>
      <RequestReviewForm electionId={election.id} disabled={!canRequestReview} />
      {!canRequestReview ? (
        <WarningBanner title="검수 요청 제한">Draft 상태에서만 검수 요청을 보낼 수 있습니다.</WarningBanner>
      ) : null}
      <StepUpPanel
        permissionCodes={["election.approve", "election.schedule", "election.open", "election.pause", "election.resume", "election.close", "invitation.send", "invitation.resend"]}
        purpose="투표 상태 전환"
      />
      <ElectionStateCtaPanel electionId={election.id} state={election.state} />
      <AnonymousVotingNotice audience="admin" />
      <AuditNotice eventType="중단, 재개, 종료, 무효 처리" riskLevel="critical" />
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">설정 바로가기</h2>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/questions`}>
            문항/선택지
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/voters`}>
            유권자 명부
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/auth-policy`}>
            인증 정책
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" href={`/admin/elections/${election.id}/results`}>
            결과
          </Link>
        </div>
      </section>
    </div>
  );
}
