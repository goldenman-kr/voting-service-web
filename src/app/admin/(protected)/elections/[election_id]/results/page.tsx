import { notFound } from "next/navigation";

import {
  ReportExportSkeleton,
  ResultOperationPanel
} from "../../../../../../components/admin/admin-operation-forms";
import { StepUpPanel } from "../../../../../../components/admin/step-up-panel";
import { AuditNotice } from "../../../../../../components/ui/audit-notice";
import { EmptyState } from "../../../../../../components/ui/empty-state";
import { ErrorState } from "../../../../../../components/ui/error-state";
import { PageHeader } from "../../../../../../components/ui/page-header";
import { WarningBanner } from "../../../../../../components/ui/warning-banner";
import { getCurrentAdminSessionFromCookies } from "../../../../../../server/auth/current-admin";
import { getPrismaClient } from "../../../../../../server/db/prisma";
import { getAdminElectionDetail } from "../../../../../../server/elections/admin-election-view";
import { getAdminResultView } from "../../../../../../server/results/admin-actions";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
};

type ResultItem = Readonly<{
  display_label?: string;
  masked?: boolean;
  vote_count?: number;
}>;

function resultItems(data: unknown): ResultItem[] {
  if (!data || typeof data !== "object") return [];
  const result = (data as { result?: { items?: unknown } }).result;
  if (!result || !Array.isArray(result.items)) return [];
  return result.items.filter((item): item is ResultItem => Boolean(item && typeof item === "object"));
}

function privacySummary(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const result = (data as {
    result?: {
      privacy_risk_level?: string;
      can_publish_counts?: boolean;
      required_action?: string;
    };
  }).result;
  if (!result) return null;
  return {
    riskLevel: result.privacy_risk_level,
    canPublishCounts: result.can_publish_counts,
    requiredAction: result.required_action
  };
}

export default async function AdminResultsPage({ params }: Params) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) return null;
  const electionId = (await params).election_id;
  const election = await getAdminElectionDetail(getPrismaClient(), restored.session, electionId);
  if (!election) notFound();
  const resultView = await getAdminResultView(election.id);
  const rows = resultItems(resultView.data);
  const privacy = privacySummary(resultView.data);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="결과 관리"
        title={`${election.title} 결과`}
        description="결과는 집계 단위로만 표시하며 공개 이후 덮어쓰지 않습니다."
        status={election.state}
      />
      <WarningBanner title="Published 이후 정책">
        공개된 결과는 조용히 수정하거나 삭제하지 않습니다. 정정은 새 버전과 공지로 처리하고, 중대한 오류는 무효 기록으로 남깁니다.
      </WarningBanner>
      {privacy?.riskLevel ? (
        <WarningBanner title="소규모 익명투표 공개 제한">
          공개 위험도: {privacy.riskLevel}. 득표수 공개 가능 여부: {privacy.canPublishCounts ? "가능" : "제한"}.
          {privacy.requiredAction ? ` 필요한 조치: ${privacy.requiredAction}` : null}
        </WarningBanner>
      ) : null}
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">집계 결과</h2>
        {resultView.error ? (
          <ErrorState title="결과를 아직 표시할 수 없습니다" description={resultView.error} />
        ) : rows.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {rows.map((row, index) => (
              <div key={`${row.display_label ?? "item"}-${index}`} className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3">
                <span className="font-medium">{row.display_label ?? "항목"}</span>
                <span className="text-sm text-slate-700">
                  {row.masked ? "소규모 제한" : typeof row.vote_count === "number" ? `${row.vote_count}표` : "비공개"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="아직 집계 결과가 없습니다" description="Closed 이후 결과 집계를 실행하면 집계 단위 결과가 표시됩니다." />
        )}
      </section>
      <AuditNotice eventType="결과 확정, 공개, 보고서 요청" riskLevel="high" />
      <StepUpPanel
        permissionCodes={[
          "result.tally",
          "result.confirm",
          "result.publish",
          "result.correct.request",
          "election.invalidate",
          "report.export.request"
        ]}
        purpose="결과 집계, 확정, 공개, 정정, 무효 또는 보고서 export"
      />
      <ResultOperationPanel electionId={election.id} state={election.state} />
      <ReportExportSkeleton />
    </div>
  );
}
