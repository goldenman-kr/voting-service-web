import type { ReactNode } from "react";

import type { ElectionStateValue } from "../../domain/elections/state-machine";
import { StatusBadge } from "./status-badge";

export function PageHeader({
  eyebrow,
  title,
  titleActions,
  description,
  status,
  actions
}: {
  eyebrow?: string;
  title: string;
  titleActions?: ReactNode;
  description?: string;
  status?: ElectionStateValue;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] font-extrabold leading-[1.25] tracking-[-0.025em] text-ink sm:text-[28px]">
            {title}
          </h1>
          {status ? <StatusBadge status={status} /> : null}
          {titleActions}
        </div>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
