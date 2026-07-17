import Link from "next/link";
import type { ReactNode } from "react";

import type { ElectionStateValue } from "../../domain/elections/state-machine";
import type { DemoElection } from "../../lib/ui/demo-data";
import { getElectionStateUi } from "../../lib/ui/election-state-ui";
import { StatusBadge } from "../ui/status-badge";
import { WarningBanner } from "../ui/warning-banner";

export function MetricCard({
  label,
  value,
  hint,
  featured = false
}: {
  label: string;
  value: string | number;
  hint?: string;
  featured?: boolean;
}) {
  return (
    <div className={["relative overflow-hidden rounded-card border bg-white p-4 shadow-card", featured ? "border-brand-100" : "border-line"].join(" ")}>
      {featured ? <span className="absolute inset-y-0 left-0 w-1 bg-brand-600" /> : null}
      <p className="text-[13px] font-semibold text-ink-muted">{label}</p>
      <p className="mt-2 text-[26px] font-extrabold tracking-[-0.02em] text-ink">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function ElectionTable({ elections }: { elections: readonly DemoElection[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-normal text-slate-600">
          <tr>
            <th className="px-4 py-3">투표</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">방식</th>
            <th className="px-4 py-3">참여율</th>
            <th className="px-4 py-3">일정</th>
            <th className="px-4 py-3">작업</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {elections.map((election) => (
            <tr key={election.id}>
              <td className="px-4 py-4">
                <p className="font-medium text-slate-950">{election.title}</p>
                <p className="mt-1 text-xs text-slate-500">{election.description}</p>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={election.state} size="sm" />
              </td>
              <td className="px-4 py-4">{election.votingMode === "anonymous" ? "익명" : "기명"}</td>
              <td className="px-4 py-4">
                {Math.round((election.participatedCount / election.eligibleCount) * 100)}%
              </td>
              <td className="px-4 py-4 text-slate-600">{election.endsAt}</td>
              <td className="px-4 py-4">
                <Link
                  href={`/admin/elections/${election.id}`}
                  className="font-semibold text-blue-700 hover:text-blue-900"
                >
                  상세
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StateOperationPanel({
  election
}: {
  election: { state: ElectionStateValue };
}) {
  const ui = getElectionStateUi(election.state);
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">상태 관리</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{ui.description}</p>
        </div>
        <StatusBadge status={election.state} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
          {ui.adminCta}
        </button>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          사유 입력 필요
        </button>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-400" disabled>
          금지 작업 숨김
        </button>
      </div>
      {ui.warning ? (
        <div className="mt-4">
          <WarningBanner>{ui.warning}</WarningBanner>
        </div>
      ) : null}
    </section>
  );
}

export function FormSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

export function TextInput({
  label,
  placeholder
}: {
  label: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <input
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        placeholder={placeholder}
      />
    </label>
  );
}
