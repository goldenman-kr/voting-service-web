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

async function submitDraft(draft: DraftPayload, isRevote: boolean) {
  const response = await fetch(isRevote ? "/api/v1/voter/ballots/revote" : "/api/v1/voter/ballots", {
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

  return (
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
      {completion?.completed ? (
        <p className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          마감 전 다시 제출하면 마지막으로 접수된 투표만 공식 집계됩니다. 이전 선택 내용은 표시하지 않습니다.
        </p>
      ) : null}
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
            question.options.map((option) => (
              <label
                key={option.id}
                className="flex min-h-14 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-base font-medium"
              >
                <input
                  type={question.question_type === "multiple_choice" ? "checkbox" : "radio"}
                  name={answerName(question.id)}
                  value={option.id}
                  required={question.required && question.question_type !== "multiple_choice"}
                  className="h-5 w-5"
                />
                <span>{option.label}</span>
              </label>
            ))
          )}
        </fieldset>
      ))}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" className="min-h-12 w-full rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white">
        제출 전 확인
      </button>
    </form>
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
            await submitDraft(draft, isRevote);
            clearDraft();
            router.push("/voter/complete");
          } catch (submissionError) {
            setPending(false);
            setError(submissionError instanceof Error ? submissionError.message : "투표를 접수하지 못했습니다.");
          }
        }}
        className="min-h-12 w-full rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-400"
      >
        {pending ? "제출 중" : isRevote ? "다시 제출" : "제출"}
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
