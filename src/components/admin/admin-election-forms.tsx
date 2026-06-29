"use client";

import { useActionState } from "react";

import { AuthenticationMethod } from "../../guardrails/index.js";
import {
  configureAuthenticationPolicyAction,
  createElectionDraftAction,
  createQuestionWithOptionsAction,
  importVoterRegistryAction,
  requestReviewAction,
  type AdminActionState
} from "../../server/elections/admin-actions";

const initialState: AdminActionState = { ok: false };

function ActionMessage({ state }: { state: AdminActionState }) {
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

export function CreateElectionForm() {
  const [state, action, pending] = useActionState(createElectionDraftAction, initialState);
  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        투표 제목
        <input name="title" required className="rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        설명
        <textarea name="description" rows={3} className="rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        투표 유형
        <select name="electionType" className="rounded-md border border-slate-300 px-3 py-2">
          <option value="representative_election">대표 선출</option>
          <option value="yes_no_agenda">중요 안건 찬반</option>
          <option value="multiple_choice_agenda">중요 안건 선택</option>
          <option value="opinion_collection">기타 의견 수렴</option>
        </select>
      </label>
      <input type="hidden" name="votingMode" value="anonymous" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          시작일시
          <input name="startsAt" type="datetime-local" required className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          종료일시
          <input name="endsAt" type="datetime-local" required className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
      </div>
      <ActionMessage state={state} />
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
          {pending ? "생성 중" : "초안 생성"}
        </button>
      </div>
    </form>
  );
}

export function QuestionOptionForm({
  electionId,
  disabled
}: {
  electionId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(createQuestionWithOptionsAction, initialState);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="electionId" value={electionId} />
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        문항 제목
        <input name="title" disabled={disabled} required className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        선택지
        <textarea
          name="options"
          rows={4}
          disabled={disabled}
          required
          placeholder={"한 줄에 하나씩 입력\n예: 후보 A\n후보 B"}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
        />
      </label>
      <ActionMessage state={state} />
      <button type="submit" disabled={disabled || pending} className="w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
        {pending ? "추가 중" : "단일 선택 문항 추가"}
      </button>
    </form>
  );
}

const authMethodLabels: Record<string, string> = {
  [AuthenticationMethod.INVITE_LINK_ONLY]: "초대 링크만 사용",
  [AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER]: "초대 링크 + 유권자 식별자 확인",
  [AuthenticationMethod.EMAIL_CODE]: "초대 링크 + 1회성 이메일 코드",
  [AuthenticationMethod.SMS_CODE]: "초대 링크 + 1회성 SMS 코드",
  [AuthenticationMethod.KAKAO_MESSAGE]: "초대 링크 + 카카오/문자 인증",
  [AuthenticationMethod.EXTERNAL_IDENTITY]: "외부 본인확인",
  [AuthenticationMethod.SSO]: "SSO",
  [AuthenticationMethod.LEGAL_STRONG_AUTH]: "법적 효력 모드용 강한 인증"
};

const mvpEnabled = new Set<string>([
  AuthenticationMethod.INVITE_LINK_ONLY,
  AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
]);

export function AuthenticationPolicyForm({
  electionId,
  currentMethod,
  disabled
}: {
  electionId: string;
  currentMethod: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(configureAuthenticationPolicyAction, initialState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="electionId" value={electionId} />
      {Object.values(AuthenticationMethod).map((method) => {
        const available = mvpEnabled.has(method);
        return (
          <label key={method} className="flex gap-3 rounded-md border border-slate-200 bg-white p-4">
            <input
              type="radio"
              name="method"
              value={method}
              defaultChecked={currentMethod === method}
              disabled={disabled || !available}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-950">{authMethodLabels[method]}</span>
              <span className="mt-1 block font-mono text-xs text-slate-500">{method}</span>
              <span className="mt-1 block text-sm text-slate-600">
                {available ? "MVP에서 사용 가능" : "기본 비활성 - 상용화/유료/후속 확장 옵션"}
              </span>
            </span>
          </label>
        );
      })}
      <ActionMessage state={state} />
      <button type="submit" disabled={disabled || pending} className="w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
        {pending ? "저장 중" : "인증 정책 저장"}
      </button>
    </form>
  );
}

export function VoterRegistryImportForm({
  electionId,
  disabled
}: {
  electionId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(importVoterRegistryAction, initialState);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="electionId" value={electionId} />
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        명부 입력
        <textarea
          name="rows"
          rows={8}
          disabled={disabled}
          required
          placeholder={"이름,외부식별자,이메일(선택)\n홍길동,MEM-001,hong@example.com"}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
        />
      </label>
      <p className="text-xs text-slate-500">오류 메시지에는 이름, 이메일, 외부 식별자 원문을 표시하지 않습니다.</p>
      <ActionMessage state={state} />
      <button type="submit" disabled={disabled || pending} className="w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
        {pending ? "검증 중" : "명부 등록/검증"}
      </button>
    </form>
  );
}

export function RequestReviewForm({
  electionId,
  disabled
}: {
  electionId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(requestReviewAction, initialState);
  return (
    <form action={action} className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
      <input type="hidden" name="electionId" value={electionId} />
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        검수 요청 사유
        <textarea name="reason" rows={3} disabled={disabled} className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
      </label>
      <ActionMessage state={state} />
      <button type="submit" disabled={disabled || pending} className="w-fit rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
        {pending ? "요청 중" : "검수 요청"}
      </button>
    </form>
  );
}
