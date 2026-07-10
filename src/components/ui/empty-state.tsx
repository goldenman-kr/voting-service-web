import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-input bg-white p-8 text-center">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
