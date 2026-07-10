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
    ? "grid gap-3 rounded-md border border-sky-200 bg-sky-50 p-5"
    : "grid gap-3 rounded-md border border-lime-200 bg-lime-50 p-5";
  const cardClassName = isBallotMode
    ? "grid gap-3 rounded-md border border-sky-200 bg-white p-4"
    : "grid gap-3 rounded-md border border-lime-200 bg-white p-4";
  const emptyClassName = isBallotMode
    ? "rounded-md border border-dashed border-sky-300 bg-white px-4 py-5 text-sm text-slate-600"
    : "rounded-md border border-dashed border-lime-300 bg-white px-4 py-5 text-sm text-slate-600";
  const actionClassName = isBallotMode
    ? "w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
    : "w-fit rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white";

  return (
    <section className={sectionClassName}>
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {elections.length > 0 ? (
        <div className="grid gap-3">
          {elections.map((election) => (
            <article key={election.id} className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950">{election.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{election.description ?? "등록된 설명이 없습니다."}</p>
                </div>
                <StatusBadge status={election.state} size="sm" />
              </div>
              <p className="text-xs text-slate-500">
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
    <VoterShell>
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
