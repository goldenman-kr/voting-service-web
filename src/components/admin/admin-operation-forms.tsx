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
  reasonRequired: boolean;
  notice?: boolean;
}>;

function ActionMessage({ state }: { state: AdminActionState | ResultActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={[
        "rounded-md border px-3 py-2 text-sm",
        state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
      ].join(" ")}
    >
      {state.message}
    </p>
  );
}

function ReasonBox({ required = true }: { required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      사유
      <textarea
        name="reason"
        rows={3}
        required={required}
        placeholder="민감정보를 넣지 말고 운영상 필요한 요약만 입력하세요."
        className="rounded-md border border-slate-300 px-3 py-2"
      />
    </label>
  );
}

function ElectionOperationForm({
  electionId,
  operation,
  label,
  reasonRequired = true
}: {
  electionId: string;
  operation: string;
  label: string;
  reasonRequired?: boolean;
}) {
  const [state, action, pending] = useActionState(electionOperationAction, initialElectionState);
  return (
    <form action={action} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="operation" value={operation} />
      <ReasonBox required={reasonRequired} />
      <ActionMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
      >
        {pending ? "처리 중" : label}
      </button>
    </form>
  );
}

export function ElectionStateCtaPanel({
  electionId,
  state
}: {
  electionId: string;
  state: ElectionStateValue;
}) {
  const operations: OperationButton[] =
    state === ElectionState.READY_FOR_REVIEW
      ? [{ operation: "approve", label: "검수 승인", reasonRequired: true }]
      : state === ElectionState.APPROVED
        ? [
            { operation: "schedule", label: "예약 상태 전환", reasonRequired: false },
            { operation: "prepare_invitations", label: "초대 준비", reasonRequired: true }
          ]
        : state === ElectionState.SCHEDULED || state === ElectionState.NOTICE
          ? [
              { operation: "open", label: "투표 시작", reasonRequired: true },
              { operation: "send_invitations", label: "초대 발송", reasonRequired: true }
            ]
          : state === ElectionState.OPEN
            ? [
                { operation: "pause", label: "일시중단", reasonRequired: true },
                { operation: "close", label: "종료", reasonRequired: true },
                { operation: "resend_invitations", label: "초대 재발송", reasonRequired: true }
              ]
            : state === ElectionState.PAUSED
              ? [
                  { operation: "resume", label: "재개", reasonRequired: true },
                  { operation: "close", label: "종료", reasonRequired: true },
                  { operation: "resend_invitations", label: "초대 재발송", reasonRequired: true }
                ]
              : [];

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-950">운영 CTA</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          표시된 작업만 현재 상태에서 실행할 수 있습니다. 위험 작업은 추가 확인 권한이 필요합니다.
        </p>
      </div>
      {operations.length > 0 ? (
        <div className="grid gap-3">
          {operations.map((operation) => (
            <ElectionOperationForm key={operation.operation} electionId={electionId} {...operation} />
          ))}
        </div>
      ) : (
        <WarningBanner title="현재 상태에서 가능한 운영 CTA 없음">
          이 상태에서는 직접 상태 전환 작업을 제공하지 않습니다.
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
      ? [{ operation: "tally", label: "결과 집계", reasonRequired: false }]
      : state === ElectionState.PENDING_CONFIRMATION
        ? [{ operation: "confirm", label: "결과 확정", reasonRequired: true }]
        : state === ElectionState.CONFIRMED
          ? [{ operation: "publish", label: "결과 공개", reasonRequired: true, notice: true }]
          : state === ElectionState.PUBLISHED
            ? [
                { operation: "request_correction", label: "정정 요청", reasonRequired: true, notice: true },
                { operation: "invalidate", label: "무효 처리", reasonRequired: true, notice: true }
              ]
            : [];

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-950">결과 운영 CTA</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
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
  reasonRequired,
  notice
}: {
  electionId: string;
  operation: string;
  label: string;
  reasonRequired: boolean;
  notice?: boolean;
}) {
  const [actionState, action, pending] = useActionState(resultOperationAction, initialResultState);
  return (
    <form action={action} className="grid gap-3 rounded-md border border-slate-200 p-4">
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="operation" value={operation} />
      <ReasonBox required={reasonRequired} />
      {notice ? (
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          공지 문구
          <textarea name="notice" rows={3} className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
      ) : null}
      <ActionMessage state={actionState} />
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
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
        보고서 export는 목적 입력, step-up, 승인, 워터마크, 만료 링크가 필요한 후속 작업입니다.
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
