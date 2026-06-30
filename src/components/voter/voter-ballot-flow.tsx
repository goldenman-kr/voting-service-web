"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  VoterCompletionStatusView,
  VoterElectionInfoView,
  VoterQuestionView
} from "../../server/voters/voter-ui-data";

const draftStorageKey = "voter_current_ballot_draft";

type DraftAnswer = Readonly<{
  questionId: string;
  optionIds: readonly string[];
  freeText?: string;
}>;

type DraftPayload = Readonly<{
  answers: readonly DraftAnswer[];
}>;

type DetailOption = Readonly<{
  label: string;
  description?: string | null;
}>;

function answerName(questionId: string): string {
  return `answer:${questionId}`;
}

function freeTextName(questionId: string): string {
  return `freeText:${questionId}`;
}

function draftFromForm(election: VoterElectionInfoView, form: HTMLFormElement): DraftPayload {
  const formData = new FormData(form);
  return {
    answers: election.questions.map((question) => ({
      questionId: question.id,
      optionIds: formData.getAll(answerName(question.id)).map(String).filter(Boolean),
      freeText: String(formData.get(freeTextName(question.id)) ?? "").trim() || undefined
    }))
  };
}

function loadDraft(): DraftPayload | undefined {
  try {
    const raw = window.sessionStorage.getItem(draftStorageKey);
    return raw ? (JSON.parse(raw) as DraftPayload) : undefined;
  } catch {
    return undefined;
  }
}

function clearDraft() {
  window.sessionStorage.removeItem(draftStorageKey);
}

function questionInstruction(question: VoterQuestionView): string {
  if (question.question_type === "multiple_choice") {
    return `${question.min_select ?? 0}개 이상 ${question.max_select ?? question.options.length}개 이하 선택`;
  }
  if (question.question_type === "free_text") {
    return "5000자 이내로 입력";
  }
  return "하나만 선택";
}

async function submitDraft(draft: DraftPayload) {
  const response = await fetch("/api/v1/voter/ballots", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(draft)
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: { message?: string };
  };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message ?? "투표를 접수하지 못했습니다.");
  }
}

export function VoterBallotForm({
  election,
  completion
}: {
  election: VoterElectionInfoView;
  completion?: VoterCompletionStatusView;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [detailOption, setDetailOption] = useState<DetailOption>();

  if (completion?.completed) {
    return (
      <section className="rounded-md border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
        투표참여가 완료되었습니다. 제출 후에는 다시 수정할 수 없습니다.
      </section>
    );
  }

  return (
    <>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const draft = draftFromForm(election, event.currentTarget);
          const missing = election.questions.find(
            (question, index) =>
              question.required &&
              draft.answers[index] &&
              draft.answers[index].optionIds.length === 0 &&
              !draft.answers[index].freeText
          );
          if (missing) {
            setError("필수 문항을 확인해 주세요.");
            return;
          }
          window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
          router.push("/voter/review");
        }}
      >
        {election.questions.map((question) => (
          <fieldset key={question.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
            <legend className="text-base font-semibold text-slate-950">{question.title}</legend>
            {question.description ? <p className="text-sm leading-6 text-slate-600">{question.description}</p> : null}
            <p className="text-xs font-medium text-slate-500">{questionInstruction(question)}</p>
            {question.question_type === "free_text" ? (
              <textarea
                name={freeTextName(question.id)}
                rows={5}
                required={question.required}
                maxLength={5000}
                className="rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            ) : (
              question.options.map((option) => {
                const inputId = `${answerName(question.id)}:${option.id}`;
                return (
                  <div
                    key={option.id}
                    className="flex min-h-14 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-base font-medium"
                  >
                    <input
                      id={inputId}
                      type={question.question_type === "multiple_choice" ? "checkbox" : "radio"}
                      name={answerName(question.id)}
                      value={option.id}
                      required={question.required && question.question_type !== "multiple_choice"}
                      className="h-5 w-5"
                    />
                    <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                      {option.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => setDetailOption(option)}
                      className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
                    >
                      자세히
                    </button>
                  </div>
                );
              })
            )}
          </fieldset>
        ))}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" className="min-h-12 w-full rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white">
          제출 전 확인
        </button>
      </form>
      {detailOption ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="option-detail-title" className="grid w-full max-w-lg gap-4 rounded-md bg-white p-5 shadow-xl">
            <div>
              <h2 id="option-detail-title" className="text-lg font-semibold text-slate-950">{detailOption.label}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {detailOption.description || "등록된 자세한 설명이 없습니다."}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDetailOption(undefined)}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function VoterReviewSubmit({
  election,
  isRevote
}: {
  election: VoterElectionInfoView;
  isRevote: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPayload>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const optionLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const question of election.questions) {
      for (const option of question.options) {
        labels.set(option.id, option.label);
      }
    }
    return labels;
  }, [election.questions]);

  useEffect(() => {
    setDraft(loadDraft());
  }, []);

  if (!draft) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700">
        제출 전 확인할 선택값이 없습니다. 투표 입력 화면에서 다시 선택해 주세요.
      </div>
    );
  }

  if (isRevote) {
    return (
      <section className="rounded-md border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
        투표참여가 완료되었습니다. 제출 후에는 다시 수정할 수 없습니다.
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-5">
        {draft.answers.map((answer) => {
          const question = election.questions.find((candidate) => candidate.id === answer.questionId);
          const selectedLabels = answer.optionIds.map((optionId) => optionLabels.get(optionId)).filter(Boolean);
          return (
            <div key={answer.questionId} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
              <p className="font-semibold text-slate-950">{question?.title ?? "문항"}</p>
              <p className="mt-1 text-sm text-slate-700">
                {selectedLabels.length > 0 ? selectedLabels.join(", ") : answer.freeText ? "자유 의견 입력됨" : "선택 없음"}
              </p>
            </div>
          );
        })}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await submitDraft(draft);
            clearDraft();
            router.push("/voter/complete");
          } catch (submissionError) {
            setPending(false);
            setError(submissionError instanceof Error ? submissionError.message : "투표를 접수하지 못했습니다.");
          }
        }}
        className="min-h-12 w-full rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-400"
      >
        {pending ? "제출 중" : "제출"}
      </button>
      <button
        type="button"
        onClick={() => router.push("/voter/ballot")}
        className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800"
      >
        수정
      </button>
    </section>
  );
}
