"use client";

import type { ReactNode } from "react";
import { useActionState, useMemo, useState } from "react";

import { AuthenticationMethod } from "../../guardrails/index.js";
import { electionTypeLabels } from "../../lib/ui/election-labels";
import {
  formatVoterRegistryRows,
  parseVoterRegistryTextRows,
  validateVoterRegistryFields,
  voterRegistryCsvHeader,
  type ParsedVoterRegistryRow,
  type VoterRegistryFields
} from "../../lib/voter-registry-fields";
import {
  configureAuthenticationPolicyAction,
  createElectionDraftAction,
  createElectionWizardAction,
  createQuestionWithOptionsAction,
  importVoterRegistryAction,
  requestReviewAction,
  updateElectionAuthPolicyFromWizardAction,
  updateElectionBasicInfoAction,
  updateElectionQuestionsAndOptionsAction,
  type AdminActionState
} from "../../server/elections/admin-actions";
import type { ManagedVoterRegistrySummary } from "../../server/voter-registries/admin-view";

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

const wizardSteps = [
  { id: 0, label: "1 기본 정보" },
  { id: 1, label: "2 문항/선택지" },
  { id: 2, label: "3 선거인 명부" }
] as const;

type WizardOption = Readonly<{
  id: number;
  title: string;
  description: string;
}>;

type EditBasicInfo = Readonly<{
  electionId: string;
  title: string;
  description?: string | null;
  electionType: string;
  startsAt: string;
  endsAt: string;
}>;

type EditQuestionOption = Readonly<{
  id: string;
  title: string;
  description?: string | null;
  questionType: string;
  displayOrder: number;
  options: readonly {
    id: string;
    label: string;
    description?: string | null;
    displayOrder: number;
  }[];
}>;

type EditQuestionsAndOptions = Readonly<{
  electionId: string;
  questions: readonly EditQuestionOption[];
}>;

type EditWizardSetupPolicy = Readonly<{
  electionId: string;
  currentMethod?: string | null;
  voterRegistry?: {
    status: string;
    totalRows: number;
    validRows: number;
  } | null;
}>;

function FieldHelp({ children }: { children: ReactNode }) {
  return <span className="text-xs leading-5 text-slate-500">{children}</span>;
}

function WizardStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <ol className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm sm:grid-cols-3">
      {wizardSteps.map((step) => {
        const active = step.id === currentStep;
        const complete = step.id < currentStep;
        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={[
              "rounded-md border px-3 py-2 font-semibold",
              active
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : complete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-600"
            ].join(" ")}
          >
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

function rowsToVoterCount(rows: string): number {
  return parseVoterRegistryTextRows(rows).filter((row) => validateVoterRegistryFields(row).ok).length;
}

function previewRowsFromText(text: string): ParsedVoterRegistryRow[] {
  return parseVoterRegistryTextRows(text).slice(0, 20);
}

export function VoterRegistryFileImportControl({
  rows,
  onRowsChange,
  disabled
}: {
  rows: string;
  onRowsChange: (value: string) => void;
  disabled: boolean;
}) {
  const [previewRows, setPreviewRows] = useState<ParsedVoterRegistryRow[]>(() => previewRowsFromText(rows));
  const [fileMessage, setFileMessage] = useState<string | null>(null);

  async function parseFile(file: File) {
    setFileMessage(null);
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
      setFileMessage("CSV 또는 XLSX 파일만 불러올 수 있습니다.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setFileMessage("파일은 1MB 이하만 불러올 수 있습니다.");
      return;
    }

    try {
      let text = "";
      if (lowerName.endsWith(".csv")) {
        text = await file.text();
      } else {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const sheets = await readXlsxFile(file);
        const matrix = sheets[0]?.data ?? [];
        text = matrix.map((row: unknown[]) => row.map((cell: unknown) => String(cell ?? "").trim()).join(",")).join("\n");
      }
      const parsed = parseVoterRegistryTextRows(text);
      if (parsed.length === 0) {
        setFileMessage("읽을 수 있는 명부 행이 없습니다.");
        return;
      }
      onRowsChange(formatVoterRegistryRows(parsed as Partial<VoterRegistryFields>[]));
      setPreviewRows(parsed.slice(0, 20));
      const invalidCount = parsed.filter((row) => !validateVoterRegistryFields(row).ok).length;
      setFileMessage(
        invalidCount > 0
          ? `파일을 불러왔습니다. 확인이 필요한 행 ${invalidCount}건이 있습니다.`
          : `파일을 불러왔습니다. ${parsed.length}건을 확인해 주세요.`
      );
    } catch {
      setFileMessage("파일을 읽을 수 없습니다. 형식과 컬럼명을 확인해 주세요.");
    }
  }

  const preview = previewRowsFromText(rows);
  const visibleRows = preview.length > 0 ? preview : previewRows;

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        CSV/XLSX 파일 불러오기
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={disabled}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void parseFile(file);
            event.currentTarget.value = "";
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
        />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        파일은 서버에 저장하지 않고 브라우저에서 먼저 읽습니다. 컬럼은 {voterRegistryCsvHeader} 순서 또는 같은 이름의 헤더를 사용합니다.
      </p>
      {fileMessage ? <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{fileMessage}</p> : null}
      {visibleRows.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="w-full min-w-[620px] border-collapse text-left text-xs">
            <thead className="bg-slate-100 font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2">행</th>
                <th className="px-3 py-2">호수번호</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">식별번호</th>
                <th className="px-3 py-2">생년월일</th>
                <th className="px-3 py-2">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleRows.map((row) => {
                const valid = validateVoterRegistryFields(row).ok;
                return (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.householdNumber ?? ""}</td>
                    <td className="px-3 py-2">{row.name ?? ""}</td>
                    <td className="px-3 py-2">{row.identifierLast4 ?? ""}</td>
                    <td className="px-3 py-2">{row.birthDate6 ?? ""}</td>
                    <td className={["px-3 py-2", valid ? "text-emerald-700" : "text-red-700"].join(" ")}>
                      {valid ? "정상" : "확인 필요"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function CreateElectionWizardForm({
  managedRegistries = []
}: {
  managedRegistries?: readonly ManagedVoterRegistrySummary[];
}) {
  const [state, action, pending] = useActionState(createElectionWizardAction, initialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [electionType, setElectionType] = useState("representative_election");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [options, setOptions] = useState<WizardOption[]>([
    { id: 1, title: "", description: "" },
    { id: 2, title: "", description: "" }
  ]);
  const [voterRows, setVoterRows] = useState("");
  const [registryMode, setRegistryMode] = useState<"existing" | "manual">(
    managedRegistries.length > 0 ? "existing" : "manual"
  );
  const [managedRegistryId, setManagedRegistryId] = useState("");

  const filledOptions = useMemo(
    () => options.filter((option) => option.title.trim().length > 0),
    [options]
  );
  const isStepOneComplete = Boolean(title.trim() && electionType && startsAt && endsAt && new Date(endsAt) > new Date(startsAt));
  const isStepTwoComplete = filledOptions.length >= 2;
  const isStepThreeComplete =
    registryMode === "existing" ? Boolean(managedRegistryId) : rowsToVoterCount(voterRows) > 0;
  const canSubmit = isStepOneComplete && isStepTwoComplete && isStepThreeComplete && !pending;

  const disabledReason =
    currentStep === 0 && !isStepOneComplete
      ? "투표 제목, 유형, 시작일시, 종료일시를 모두 입력하고 종료일시가 시작일시보다 뒤인지 확인해 주세요."
      : currentStep === 1 && !isStepTwoComplete
        ? "최소 2개의 선택 항목 제목을 입력해 주세요."
        : currentStep === 2 && !isStepThreeComplete
          ? registryMode === "existing"
            ? "연결할 독립 선거인명부를 선택해 주세요."
            : "선거인 명부를 1명 이상 입력해 주세요."
          : undefined;

  function updateOption(id: number, patch: Partial<WizardOption>) {
    setOptions((current) => current.map((option) => (option.id === id ? { ...option, ...patch } : option)));
  }

  function addOption() {
    setOptions((current) => [
      ...current,
      {
        id: Math.max(...current.map((option) => option.id)) + 1,
        title: "",
        description: ""
      }
    ]);
  }

  function removeOption(id: number) {
    setOptions((current) => (current.length <= 2 ? current : current.filter((option) => option.id !== id)));
  }

  function goNext() {
    if (currentStep === 0 && isStepOneComplete) setCurrentStep(1);
    if (currentStep === 1 && isStepTwoComplete) setCurrentStep(2);
  }

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (currentStep < 2) {
          event.preventDefault();
          goNext();
        }
      }}
      className="grid gap-6"
    >
      <WizardStepIndicator currentStep={currentStep} />

      <section className={currentStep === 0 ? "grid gap-5" : "hidden"}>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">기본 정보</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            유권자가 처음 보게 되는 투표 이름과 일정을 정합니다. 시작일시 이후에는 투표 문항과 명부
            수정이 제한될 수 있습니다.
          </p>
        </div>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          투표 제목
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="예: 2026년 입주자대표 선출"
          />
          <FieldHelp>투표 제목은 유권자에게 표시됩니다.</FieldHelp>
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          설명
          <textarea
            name="description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="투표 목적과 유권자가 알아야 할 배경을 적어주세요."
          />
          <FieldHelp>민감한 개인정보나 내부 식별자는 설명에 쓰지 않는 것을 권장합니다.</FieldHelp>
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          투표 유형
          <select
            name="electionType"
            value={electionType}
            onChange={(event) => setElectionType(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {electionTypeLabels.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <FieldHelp>투표 성격에 가장 가까운 유형을 선택해 주세요.</FieldHelp>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            시작일시
            <input
              name="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <FieldHelp>시작일시 이후에는 문항과 명부 수정이 제한될 수 있습니다.</FieldHelp>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            종료일시
            <input
              name="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <FieldHelp>종료일시 이후에는 투표가 종료되고 결과 공개 절차로 이동합니다.</FieldHelp>
          </label>
        </div>
      </section>

      <section className={currentStep === 1 ? "grid gap-5" : "hidden"}>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">선택 항목</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                투표 제목과 설명을 안건으로 사용합니다. 이 단계에서는 유권자가 고를 선택 항목만 입력합니다.
                선택 항목은 최소 2개가 필요합니다.
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              입력된 선택 항목 {filledOptions.length}개
            </span>
          </div>
        </div>

        <div className="grid gap-3">
          {options.map((option, index) => (
            <section key={option.id} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-950">선택 항목 {index + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeOption(option.id)}
                  disabled={options.length <= 2}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:text-slate-400"
                >
                  삭제
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  유권자에게 표시될 제목
                  <input
                    name="optionTitle"
                    value={option.title}
                    onChange={(event) => updateOption(option.id, { title: event.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-2"
                    placeholder="예: 후보 A"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  자세히 보기 설명
                  <textarea
                    name="optionDescription"
                    rows={3}
                    value={option.description}
                    onChange={(event) => updateOption(option.id, { description: event.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-2"
                    placeholder="유권자가 자세히 보기에서 확인할 설명을 적어주세요."
                  />
                </label>
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                  사진 업로드는 별도 storage 설계가 필요한 기능입니다. 파일 크기, 형식, 보관 위치를 확정한 뒤 제공합니다.
                </div>
              </div>
            </section>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            항목 추가
          </button>
        </div>
      </section>

      <section className={currentStep === 2 ? "grid gap-5" : "hidden"}>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">선거인 명부</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            이 투표에 사용할 명부를 직접 입력하거나 CSV/XLSX 파일에서 불러옵니다. 입력한 정보는 선거인
            확인용으로만 사용되며, 투표가 시작되면 명부 수정이 제한됩니다.
          </p>
        </div>

        <input type="hidden" name="registryMode" value={registryMode} />
        <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">명부 연결 방식</p>
          <label className="flex gap-3 rounded-md border border-slate-200 p-3 text-sm">
            <input
              type="radio"
              name="registryModeChoice"
              checked={registryMode === "existing"}
              disabled={managedRegistries.length === 0}
              onChange={() => setRegistryMode("existing")}
            />
            <span>
              <span className="block font-semibold text-slate-950">기존 독립 명부 선택</span>
              <span className="mt-1 block text-slate-600">선택한 명부는 이 투표에 연결됩니다. 투표가 실제 시작되기 전까지 원본 명부를 수정할 수 있습니다.</span>
            </span>
          </label>
          <label className="flex gap-3 rounded-md border border-slate-200 p-3 text-sm">
            <input
              type="radio"
              name="registryModeChoice"
              checked={registryMode === "manual"}
              onChange={() => setRegistryMode("manual")}
            />
            <span>
              <span className="block font-semibold text-slate-950">이 투표에서 직접 입력</span>
              <span className="mt-1 block text-slate-600">독립 명부가 없거나 새 투표 전용 명부가 필요할 때 사용합니다.</span>
            </span>
          </label>
        </div>

        {registryMode === "existing" ? (
          <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              독립 선거인명부
              <select
                name="managedRegistryId"
                value={managedRegistryId}
                onChange={(event) => setManagedRegistryId(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">명부를 선택해 주세요</option>
                {managedRegistries.map((registry) => (
                  <option key={registry.id} value={registry.id}>
                    {registry.title} · {registry.validRows}명 · {registry.editable ? "수정 가능" : "시작된 투표에서 사용 중"}
                  </option>
                ))}
              </select>
              <FieldHelp>
                목록에 없으면 선거인명부 관리에서 새 명부를 만든 뒤 이 화면으로 돌아와 선택합니다.
              </FieldHelp>
            </label>
            <a
              href="/admin/voter-registries/new"
              className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              새 명부 만들기
            </a>
          </div>
        ) : (
          <>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              명부 입력
              <textarea
                name="voterRows"
                rows={9}
                value={voterRows}
                onChange={(event) => setVoterRows(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder={"호수번호,이름,식별번호,생년월일\n7,홍길동,0001,900101\n12,김영희,0423,880715"}
              />
              <FieldHelp>
                호수번호는 숫자 1~2자리, 식별번호는 숫자 4자리, 생년월일은 숫자 6자리로 입력합니다.
                식별번호와 생년월일의 앞자리 0은 그대로 유지합니다.
              </FieldHelp>
            </label>
            <VoterRegistryFileImportControl rows={voterRows} onRowsChange={setVoterRows} disabled={pending} />
          </>
        )}

        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-950">투표 참여 인증 방식</p>
          <p className="mt-1">
            기본값은 “초대 링크 + 유권자 식별자 확인”입니다. 비용이 발생하는 인증 방식과 1회성 코드는
            후속 설정 화면에서 별도로 다룹니다.
          </p>
        </div>
      </section>

      {disabledReason ? <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">{disabledReason}</p> : null}
      <ActionMessage state={state} />

      <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
          disabled={currentStep === 0 || pending}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:text-slate-400"
        >
          이전
        </button>
        {currentStep < 2 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={Boolean(disabledReason) || pending}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          >
            다음
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          >
            {pending ? "저장 중" : "완료"}
          </button>
        )}
      </div>
    </form>
  );
}

export function EditElectionBasicInfoForm({ initial }: { initial: EditBasicInfo }) {
  const [state, action, pending] = useActionState(updateElectionBasicInfoAction, initialState);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [electionType, setElectionType] = useState(initial.electionType);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);

  const isComplete = Boolean(title.trim() && electionType && startsAt && endsAt && new Date(endsAt) > new Date(startsAt));
  const disabledReason = !isComplete
    ? "투표 제목, 유형, 시작일시, 종료일시를 모두 입력하고 종료일시가 시작일시보다 뒤인지 확인해 주세요."
    : undefined;

  return (
    <form action={action} className="grid gap-5 rounded-md border border-slate-200 bg-white p-5">
      <input type="hidden" name="electionId" value={initial.electionId} />
      <div>
        <h2 className="text-lg font-semibold text-slate-950">1 기본 정보</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          이번 단계에서는 유권자에게 표시되는 투표 제목, 설명, 유형, 일정을 수정합니다. 문항, 선택 항목,
          선거인 명부는 아래 읽기 전용 단계에서 확인만 합니다.
        </p>
      </div>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        투표 제목
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <FieldHelp>투표 제목은 유권자에게 표시됩니다.</FieldHelp>
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        설명
        <textarea
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <FieldHelp>투표 목적과 배경을 적어주세요. 민감한 개인정보나 내부 식별자는 넣지 마세요.</FieldHelp>
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        투표 유형
        <select
          name="electionType"
          value={electionType}
          onChange={(event) => setElectionType(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          {electionTypeLabels.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <FieldHelp>투표 성격에 가장 가까운 유형을 선택해 주세요.</FieldHelp>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          시작일시
          <input
            name="startsAt"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <FieldHelp>시작일시 이후에는 문항, 선택 항목, 선거인 명부 수정이 제한됩니다.</FieldHelp>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          종료일시
          <input
            name="endsAt"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <FieldHelp>종료일시 이후에는 투표가 종료되고 결과 공개 절차로 이동합니다.</FieldHelp>
        </label>
      </div>

      {disabledReason ? <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">{disabledReason}</p> : null}
      <ActionMessage state={state} />
      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={!isComplete || pending}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          {pending ? "저장 중" : "기본 정보 저장"}
        </button>
        <a
          href={`/admin/elections/${initial.electionId}`}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          취소
        </a>
      </div>
    </form>
  );
}

export function EditElectionQuestionsAndOptionsForm({ initial }: { initial: EditQuestionsAndOptions }) {
  const [state, action, pending] = useActionState(updateElectionQuestionsAndOptionsAction, initialState);
  const [newOptionRows, setNewOptionRows] = useState<Record<string, number>>(
    Object.fromEntries(initial.questions.map((question) => [question.id, 1]))
  );

  function appendNewOptionRow(questionId: string) {
    setNewOptionRows((current) => ({
      ...current,
      [questionId]: (current[questionId] ?? 1) + 1
    }));
  }

  if (initial.questions.length === 0) {
    return (
      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">2 문항/선택 항목</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            아직 등록된 문항이 없습니다. 이번 단계에서는 기존 문항을 삭제하거나 새 질문 구조를 만들지 않습니다.
          </p>
        </div>
      </section>
    );
  }

  return (
    <form action={action} className="grid gap-5 rounded-md border border-slate-200 bg-white p-5">
      <input type="hidden" name="electionId" value={initial.electionId} />
      <div>
        <h2 className="text-lg font-semibold text-slate-950">2 문항/선택 항목</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          이 단계에서는 기존 질문과 선택 항목의 문구를 수정하고, 새 선택 항목을 추가할 수 있습니다.
          투표 무결성을 위해 이 단계에서는 질문 삭제, 선택 항목 삭제, 순서 변경은 제공하지 않습니다.
        </p>
        <p className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-950">
          삭제와 순서 변경은 결과 의미에 영향을 줄 수 있어 후속 단계에서 별도 정책을 확정한 뒤 제공합니다.
        </p>
      </div>

      <div className="grid gap-4">
        {initial.questions.map((question, questionIndex) => (
          <section key={question.id} className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <input type="hidden" name="questionId" value={question.id} />
            <div>
              <h3 className="text-base font-semibold text-slate-950">질문 {questionIndex + 1}</h3>
              <p className="mt-1 text-xs text-slate-500">질문 유형, 필수 여부, 최소/최대 선택 수는 이번 단계에서 변경하지 않습니다.</p>
            </div>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              질문 제목
              <input
                name={`questionTitle:${question.id}`}
                defaultValue={question.title}
                required
                className="rounded-md border border-slate-300 bg-white px-3 py-2"
              />
              <FieldHelp>유권자에게 표시되는 질문 문구만 수정합니다.</FieldHelp>
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              질문 설명
              <textarea
                name={`questionDescription:${question.id}`}
                rows={3}
                defaultValue={question.description ?? ""}
                className="rounded-md border border-slate-300 bg-white px-3 py-2"
              />
              <FieldHelp>설명은 비워 둘 수 있습니다. 민감한 개인정보나 내부 식별자는 넣지 마세요.</FieldHelp>
            </label>

            <div className="grid gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-950">기존 선택 항목</h4>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  기존 선택 항목은 문구만 수정할 수 있으며 화면 순서는 유지됩니다.
                </p>
              </div>
              {question.options.map((option, optionIndex) => (
                <section key={option.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
                  <input type="hidden" name={`optionId:${question.id}`} value={option.id} />
                  <h5 className="text-sm font-semibold text-slate-800">선택 항목 {optionIndex + 1}</h5>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    제목
                    <input
                      name={`optionLabel:${option.id}`}
                      defaultValue={option.label}
                      required
                      className="rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    설명
                    <textarea
                      name={`optionDescription:${option.id}`}
                      rows={2}
                      defaultValue={option.description ?? ""}
                      className="rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>
                </section>
              ))}
            </div>

            <div className="grid gap-3 rounded-md border border-dashed border-slate-300 bg-white p-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-950">새 선택 항목 추가</h4>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  새 선택 항목은 append-only 방식으로 기존 항목 뒤에만 추가됩니다. 빈 입력칸은 저장하지 않습니다.
                </p>
              </div>
              {Array.from({ length: newOptionRows[question.id] ?? 1 }).map((_, index) => (
                <section key={`${question.id}-new-${index}`} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <h5 className="text-sm font-semibold text-slate-800">추가 항목 {index + 1}</h5>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    제목
                    <input
                      name={`newOptionLabel:${question.id}`}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2"
                      placeholder="새 선택 항목 제목"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    설명
                    <textarea
                      name={`newOptionDescription:${question.id}`}
                      rows={2}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2"
                      placeholder="선택 항목 설명"
                    />
                  </label>
                </section>
              ))}
              <button
                type="button"
                onClick={() => appendNewOptionRow(question.id)}
                className="w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              >
                새 선택 항목 입력칸 추가
              </button>
            </div>
          </section>
        ))}
      </div>

      <ActionMessage state={state} />
      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          {pending ? "저장 중" : "문항/선택 항목 저장"}
        </button>
        <a
          href={`/admin/elections/${initial.electionId}`}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          상세 화면으로 돌아가기
        </a>
      </div>
    </form>
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
          {electionTypeLabels.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
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

export function EditElectionSetupPolicyForm({ initial }: { initial: EditWizardSetupPolicy }) {
  const [state, action, pending] = useActionState(updateElectionAuthPolicyFromWizardAction, initialState);
  const currentMethod = initial.currentMethod ?? AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER;
  const registry = initial.voterRegistry;
  const registrySummary = registry
    ? `${registry.validRows}/${registry.totalRows}명 확인 가능`
    : "아직 등록된 선거인 명부가 없습니다.";

  return (
    <section className="grid gap-5 rounded-md border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">3 선거인 명부/인증 방식</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          투표 참여 인증 방식은 이 화면에서 저장할 수 있고, 선거인 명부는 현재 구조에서 안전한 요약과
          세부 관리 화면 링크만 제공합니다.
        </p>
      </div>

      <form action={action} className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <input type="hidden" name="electionId" value={initial.electionId} />
        <div>
          <h3 className="text-base font-semibold text-slate-950">투표 참여 인증 방식</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            유권자가 투표에 참여할 때 어떤 방식으로 본인 확인을 할지 설정합니다. 현재 내부 베타에서는
            초대 링크와 선거인 확인을 함께 사용하는 방식을 기본으로 권장합니다.
          </p>
        </div>

        <div className="grid gap-3">
          {Object.values(AuthenticationMethod).map((method) => {
            const available = mvpEnabled.has(method);
            return (
              <label
                key={method}
                className={[
                  "flex gap-3 rounded-md border bg-white p-4",
                  available ? "border-slate-200" : "border-slate-200 opacity-70"
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="method"
                  value={method}
                  defaultChecked={currentMethod === method}
                  disabled={!available || pending}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">{authMethodLabels[method]}</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">
                    {available
                      ? "현재 MVP에서 저장할 수 있습니다."
                      : "후속 제공 예정입니다. 공급자 연동과 보안 정책이 준비되기 전에는 저장할 수 없습니다."}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <ActionMessage state={state} />
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          {pending ? "저장 중" : "투표 참여 인증 방식 저장"}
        </button>
      </form>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">선거인 명부</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            독립 선거인명부는 명부 관리 화면에서 만들고 복제할 수 있습니다. 이 투표에 이미 연결된 명부는
            아래 세부 화면에서 확인하고, 새 투표 생성 시에는 기존 독립 명부를 선택해 연결할 수 있습니다.
          </p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-500">등록 상태</dt>
            <dd>{registrySummary}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">명부 수정 가능 여부</dt>
            <dd>초안 상태와 시작 전 조건에서 세부 화면을 통한 추가 등록만 가능합니다.</dd>
          </div>
        </dl>
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-950">
          통합 편집 마법사에서는 이미 검수 흐름에 들어간 투표의 명부 교체를 제공하지 않습니다. 변경이 필요하면
          독립 명부를 복제한 뒤 새 투표에 연결해 주세요.
        </p>
        <a
          href={`/admin/elections/${initial.electionId}/voters`}
          className="w-fit rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          선거인 명부 세부 화면으로 이동
        </a>
      </section>
    </section>
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
  const [rows, setRows] = useState("");
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="electionId" value={electionId} />
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        명부 입력
        <textarea
          name="rows"
          value={rows}
          onChange={(event) => setRows(event.target.value)}
          rows={8}
          disabled={disabled}
          required
          placeholder={"호수번호,이름,식별번호,생년월일\n7,홍길동,0001,900101\n12,김영희,0423,880715"}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
        />
      </label>
      <VoterRegistryFileImportControl rows={rows} onRowsChange={setRows} disabled={disabled || pending} />
      <p className="text-xs text-slate-500">
        오류 메시지에는 입력한 개인정보 원문을 표시하지 않습니다. 파일 원본은 서버에 저장하지 않습니다.
      </p>
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
