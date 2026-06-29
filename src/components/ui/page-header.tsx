import type { ReactNode } from "react";

import type { ElectionStateValue } from "../../domain/elections/state-machine";
import { StatusBadge } from "./status-badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  status,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  status?: ElectionStateValue;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-semibold text-blue-700">{eyebrow}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{title}</h1>
          {status ? <StatusBadge status={status} /> : null}
        </div>
        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
