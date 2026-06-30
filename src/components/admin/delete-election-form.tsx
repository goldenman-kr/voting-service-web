"use client";

import { deletePreStartElectionAction } from "../../server/elections/admin-actions";

export function DeletePreStartElectionForm({
  electionId,
  title,
  compact = false
}: {
  electionId: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <form
      action={deletePreStartElectionAction}
      onSubmit={(event) => {
        if (!window.confirm(`"${title}" 투표를 삭제할까요? 삭제된 투표는 목록에서 제외됩니다.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="reason" value="작성중/시작 전 투표 삭제" />
      <button
        type="submit"
        className={[
          "rounded-md border border-red-200 bg-white font-semibold text-red-700 hover:bg-red-50",
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        ].join(" ")}
      >
        삭제
      </button>
    </form>
  );
}
