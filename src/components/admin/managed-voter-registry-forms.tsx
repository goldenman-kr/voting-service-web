"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type FormEvent } from "react";

import {
  addManagedVoterAction,
  createManagedRegistryAction,
  deleteManagedVoterAction,
  updateManagedRegistryTitleAction,
  updateManagedVoterAction,
  type VoterRegistryActionState
} from "../../server/voter-registries/admin-actions";
import type { ManagedVoterRow } from "../../server/voter-registries/admin-view";
import { VoterRegistryFileImportControl } from "./admin-election-forms";

const initialState: VoterRegistryActionState = { ok: false };

function ActionMessage({ state }: { state: VoterRegistryActionState }) {
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

function VoterFields({
  voter,
  disabled
}: {
  voter?: ManagedVoterRow;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        호수번호
        <input
          name="householdNumber"
          required
          pattern="\d+"
          maxLength={8}
          inputMode="numeric"
          defaultValue={voter?.householdNumber === "기존 형식" ? "" : voter?.householdNumber}
          disabled={disabled}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        이름
        <input
          name="name"
          required
          defaultValue={voter?.name === "표시 제한" ? "" : voter?.name}
          disabled={disabled}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        식별번호
        <input
          name="identifierLast4"
          required
          pattern="\d{4}"
          maxLength={4}
          inputMode="numeric"
          defaultValue={voter?.identifierLast4 === "표시 제한" ? "" : voter?.identifierLast4}
          disabled={disabled}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        생년월일
        <input
          name="birthDate6"
          required
          pattern="\d{6}"
          maxLength={6}
          inputMode="numeric"
          defaultValue={voter?.birthDate6 === "기존 형식" ? "" : voter?.birthDate6}
          disabled={disabled}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
        />
      </label>
    </div>
  );
}

export function ManagedRegistryTitleActions({
  registryId,
  title,
  editable
}: {
  registryId: string;
  title: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateManagedRegistryTitleAction, initialState);
  const disabledReason = "이미 시작된 투표에서 사용 중인 명부는 제목을 수정할 수 없습니다.";

  useEffect(() => {
    if (state.ok && open) {
      setOpen(false);
      router.refresh();
    }
  }, [open, router, state.ok]);

  return (
    <>
      <button
        type="button"
        disabled={!editable}
        title={!editable ? disabledReason : undefined}
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
      >
        제목 수정
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form action={action} className="grid w-full max-w-lg gap-4 rounded-md bg-white p-5 shadow-xl">
            <input type="hidden" name="registryId" value={registryId} />
            <div>
              <h2 className="text-lg font-semibold text-slate-950">명부 제목 수정</h2>
              <p className="mt-1 text-sm text-slate-600">관리 화면에서 구분할 명부 이름을 입력합니다.</p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              명부 제목
              <input
                name="title"
                required
                maxLength={120}
                defaultValue={title}
                disabled={pending}
                className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
              />
            </label>
            <ActionMessage state={state} />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                {pending ? "저장 중" : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function CreateManagedVoterRegistryForm() {
  const [state, action, pending] = useActionState(createManagedRegistryAction, initialState);
  const [rows, setRows] = useState("");

  return (
    <form action={action} className="grid gap-5 rounded-md border border-slate-200 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          명부 제목
          <input
            name="title"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="예: 101동 선거인 명부"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          설명
          <textarea
            name="description"
            rows={3}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="관리자가 구분할 수 있는 설명을 입력합니다."
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        선거인 목록
        <textarea
          name="rows"
          value={rows}
          onChange={(event) => setRows(event.target.value)}
          rows={8}
          required
          placeholder={"호수번호,이름,식별번호,생년월일\n7,홍길동,0001,900101\n12,김영희,0423,880715"}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <VoterRegistryFileImportControl rows={rows} onRowsChange={setRows} disabled={pending} />
      <p className="text-xs leading-5 text-slate-500">
        파일은 브라우저에서 미리보기로만 파싱하며 원본 파일은 서버에 저장하지 않습니다.
      </p>
      <ActionMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
      >
        {pending ? "저장 중" : "명부 저장"}
      </button>
    </form>
  );
}

export function AddManagedVoterDialog({
  registryId,
  editable
}: {
  registryId: string;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addManagedVoterAction, initialState);
  const disabledReason = "이미 시작된 투표에서 사용 중인 명부는 선거인을 추가할 수 없습니다.";

  return (
    <>
      <button
        type="button"
        disabled={!editable}
        title={!editable ? disabledReason : undefined}
        onClick={() => setOpen(true)}
        className="w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
      >
        선거인 추가
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form action={action} className="grid w-full max-w-xl gap-4 rounded-md bg-white p-5 shadow-xl">
            <input type="hidden" name="registryId" value={registryId} />
            <div>
              <h2 className="text-lg font-semibold text-slate-950">선거인 추가</h2>
              <p className="mt-1 text-sm text-slate-600">호수번호, 이름, 식별번호, 생년월일을 입력합니다.</p>
            </div>
            <VoterFields disabled={pending} />
            <ActionMessage state={state} />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                {pending ? "저장 중" : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function ManagedVoterRowActions({
  registryId,
  voter,
  editable
}: {
  registryId: string;
  voter: ManagedVoterRow;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateManagedVoterAction, initialState);
  const disabledReason = "이미 시작된 투표에서 사용 중인 명부는 선거인을 수정하거나 삭제할 수 없습니다.";

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("선택한 선거인을 명부에서 제외할까요?")) {
      event.preventDefault();
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={!editable}
        title={!editable ? disabledReason : undefined}
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
      >
        수정
      </button>
      <form action={deleteManagedVoterAction} onSubmit={confirmDelete}>
        <input type="hidden" name="registryId" value={registryId} />
        <input type="hidden" name="voterId" value={voter.id} />
        <button
          type="submit"
          disabled={!editable}
          title={!editable ? disabledReason : undefined}
          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:bg-slate-100 disabled:text-slate-400"
        >
          삭제
        </button>
      </form>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form action={action} className="grid w-full max-w-xl gap-4 rounded-md bg-white p-5 shadow-xl">
            <input type="hidden" name="registryId" value={registryId} />
            <input type="hidden" name="voterId" value={voter.id} />
            <div>
              <h2 className="text-lg font-semibold text-slate-950">선거인 수정</h2>
              <p className="mt-1 text-sm text-slate-600">수정하면 선거인 확인용 식별값도 함께 갱신됩니다.</p>
            </div>
            <VoterFields voter={voter} disabled={pending} />
            <ActionMessage state={state} />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              >
                {pending ? "저장 중" : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
