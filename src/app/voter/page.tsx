import Link from "next/link";

import { StatusBadge } from "../../components/ui/status-badge";
import { PageHeader } from "../../components/ui/page-header";
import { VoterShell } from "../../components/voter/voter-shell";
import { listVoterPortalElections, type VoterPortalElectionSummary } from "../../server/voters/voter-ui-data";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function ElectionList({
  title,
  description,
  elections,
  mode
}: {
  title: string;
  description: string;
  elections: VoterPortalElectionSummary[];
  mode: "ballot" | "results";
}) {
  const isBallotMode = mode === "ballot";
  const sectionClassName = isBallotMode
    ? "grid gap-4 rounded-card border border-brand-100 bg-brand-50 p-5"
    : "grid gap-4 rounded-card border border-line bg-surface p-5";
  const cardClassName = "ui-card grid gap-3 p-5";
  const emptyClassName = "rounded-xl border border-dashed border-line-input bg-white px-4 py-5 text-sm text-ink-muted";
  const actionClassName = isBallotMode ? "ui-primary-button w-fit" : "ui-secondary-button w-fit";

  return (
    <section className={sectionClassName}>
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
      </div>
      {elections.length > 0 ? (
        <div className="grid gap-3">
          {elections.map((election) => (
            <article key={election.id} className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-ink">{election.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{election.description ?? "등록된 설명이 없습니다."}</p>
                </div>
                <StatusBadge status={election.state} size="sm" />
              </div>
              <p className="text-xs text-ink-faint">
                {formatDate(election.startsAt)} - {formatDate(election.endsAt)}
              </p>
              <Link
                href={`/voter/elections/${election.id}/verify`}
                className={actionClassName}
              >
                {mode === "ballot" ? "본인 확인 후 투표하기" : "본인 확인 후 결과 보기"}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className={emptyClassName}>
          표시할 투표가 없습니다.
        </p>
      )}
    </section>
  );
}

export default async function VoterDashboardPage() {
  const elections = await listVoterPortalElections();
  return (
    <VoterShell wide>
      <PageHeader
        eyebrow="투표하러가기"
        title="참여 가능한 투표를 선택해 주세요"
        description="진행 중인 투표와 완료된 투표를 확인할 수 있습니다. 투표를 선택한 뒤 선거인 명부 확인을 거쳐 참여하거나 결과를 볼 수 있습니다."
      />
      <ElectionList
        title="현재 진행 중인 투표"
        description="선거인 명부 확인 후 투표할 수 있습니다."
        elections={elections.active}
        mode="ballot"
      />
      <ElectionList
        title="완료된 투표"
        description="공개 정책에 따라 결과를 확인할 수 있습니다."
        elections={elections.completed}
        mode="results"
      />
    </VoterShell>
  );
}
