import type { ElectionStateValue } from "../../domain/elections/state-machine";
import { getElectionStateUi } from "../../lib/ui/election-state-ui";

const toneClass = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700"
} as const;

export function StatusBadge({
  status,
  size = "md"
}: {
  status: ElectionStateValue;
  size?: "sm" | "md";
}) {
  const ui = getElectionStateUi(status);
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border font-medium",
        toneClass[ui.tone],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      ].join(" ")}
      title={ui.description}
    >
      {ui.label}
    </span>
  );
}
