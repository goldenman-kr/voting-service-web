"use client";

import { useActionState } from "react";

import type { ElectionStateValue } from "../../domain/elections/state-machine";
import { ElectionState } from "../../guardrails/index.js";
import { electionOperationAction, type AdminActionState } from "../../server/elections/admin-actions";
import { resultOperationAction, type ResultActionState } from "../../server/results/admin-actions";
import { WarningBanner } from "../ui/warning-banner";

const initialElectionState: AdminActionState = { ok: false };
const initialResultState: ResultActionState = { ok: false };

type OperationButton = Readonly<{
  operation: string;
  label: string;
  notice?: boolean;
}>;

function ActionMessage({ state }: { state: AdminActionState | ResultActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={[
        "rounded-xl border px-3 py-2 text-sm",
        state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
      ].join(" ")}
    >
      {state.message}
    </p>
  );
}

function ElectionOperationForm({
  electionId,
  operation,
  label
}: {
  electionId: string;
  operation: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(electionOperationAction, initialElectionState);
  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-line bg-surface p-4"
      onSubmit={(event) => {
        if (operation === "cancel" && !window.confirm("이 투표를 취소하고 무효 상태로 보관하시겠습니까?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="operation" value={operation} />
      <ActionMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className={operation === "close" || operation === "cancel" ? "ui-danger-button w-fit" : operation === "pause" ? "ui-secondary-button w-fit" : "ui-primary-button w-fit"}
      >
        {pending ? "처리 중" : label}
      </button>
    </form>
  );
}

export function ElectionStateCtaPanel({
  electionId,
  state,
  canCancel = false
}: {
  electionId: string;
  state: ElectionStateValue;
  canCancel?: boolean;
}) {
  const operations: OperationButton[] =
    state === ElectionState.DRAFT ||
    state === ElectionState.READY_FOR_REVIEW ||
    state === ElectionState.APPROVED ||
    state === ElectionState.SCHEDULED ||
    state === ElectionState.NOTICE
      ? [
          { operation: "open", label: "투표 시작" },
          ...(canCancel ? [{ operation: "cancel", label: "투표 취소" }] : [])
        ]
      : state === ElectionState.OPEN
        ? [
            { operation: "pause", label: "일시중단" },
            { operation: "close", label: "종료" }
          ]
        : state === ElectionState.PAUSED
          ? [
              { operation: "resume", label: "재개" },
              { operation: "close", label: "종료" }
            ]
          : [];

  return (
    <section className="ui-card grid gap-4 p-5">
      <div>
        <h2 className="text-base font-bold text-ink">투표 상태 변경</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          표시된 작업만 현재 상태에서 실행할 수 있습니다. 투표 시작은 현재 시각으로 시작일시를 갱신하고 즉시 진행 상태로 전환합니다. 시작일이 지난 준비 상태의 투표는 취소해 무효 상태로 보관할 수 있습니다.
        </p>
      </div>
      {operations.length > 0 ? (
        <div className="grid gap-3">
          {operations.map((operation) => (
            <ElectionOperationForm key={operation.operation} electionId={electionId} {...operation} />
          ))}
        </div>
      ) : (
        <WarningBanner title="상태 변경 불가">
          현재 투표가 종료된 상태에서는 더이상 변경할 수 없습니다.
        </WarningBanner>
      )}
    </section>
  );
}

export function ResultOperationPanel({
  electionId,
  state
}: {
  electionId: string;
  state: ElectionStateValue;
}) {
  const operations: OperationButton[] =
    state === ElectionState.CLOSED
      ? [{ operation: "tally", label: "결과 집계" }]
      : state === ElectionState.PENDING_CONFIRMATION
        ? [{ operation: "confirm", label: "결과 확정" }]
        : state === ElectionState.CONFIRMED
          ? [{ operation: "publish", label: "결과 공개", notice: true }]
          : state === ElectionState.PUBLISHED
            ? [
                { operation: "invalidate", label: "무효 처리" }
              ]
            : [];

  return (
    <section className="ui-card grid gap-4 p-5">
      <div>
        <h2 className="text-base font-bold text-ink">결과 운영 CTA</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          집계, 확정, 공개, 정정, 무효 처리는 상태 정책과 결과 공개 이후 덮어쓰기 금지 원칙을 따릅니다.
        </p>
      </div>
      {operations.length > 0 ? (
        operations.map((operation) => (
          <ResultOperationForm key={operation.operation} electionId={electionId} {...operation} />
        ))
      ) : (
        <WarningBanner title="결과 작업 제한">현재 상태에서는 실행 가능한 결과 작업이 없습니다.</WarningBanner>
      )}
    </section>
  );
}

function ResultOperationForm({
  electionId,
  operation,
  label,
  notice
}: {
  electionId: string;
  operation: string;
  label: string;
  notice?: boolean;
}) {
  const [actionState, action, pending] = useActionState(resultOperationAction, initialResultState);
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="operation" value={operation} />
      {notice ? (
        <label className="grid gap-1 text-sm font-bold text-[#3A4A66]">
          공지 문구
          <textarea name="notice" rows={3} className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
      ) : null}
      <ActionMessage state={actionState} />
      <button
        type="submit"
        disabled={pending}
        className={operation === "invalidate" ? "ui-danger-button w-fit" : "ui-primary-button w-fit"}
      >
        {pending ? "처리 중" : label}
      </button>
    </form>
  );
}

export function ReportExportSkeleton() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-950">보고서 export</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        보고서 export는 목적 입력, 승인, 워터마크, 만료 링크가 필요한 후속 작업입니다.
      </p>
      <button
        type="button"
        disabled
        className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-400"
      >
        후속 구현 예정
      </button>
    </section>
  );
}
