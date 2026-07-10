import type { ElectionStateValue } from "../../domain/elections/state-machine";
import { getElectionStateUi } from "../../lib/ui/election-state-ui";

const toneClass = {
  neutral: "border-[#E0E5EE] bg-[#EEF1F6] text-[#5A6577]",
  info: "border-brand-100 bg-brand-50 text-[#3E5BC0]",
  success: "border-[#CDE9D8] bg-[#E9F6EF] text-[#1F7A4D]",
  warning: "border-warning-200 bg-warning-50 text-warning-600",
  danger: "border-danger-200 bg-danger-50 text-danger-600"
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
        "inline-flex items-center rounded-full border font-bold",
        toneClass[ui.tone],
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]"
      ].join(" ")}
      title={ui.description}
    >
      {ui.label}
    </span>
  );
}
