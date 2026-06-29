"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type VoterFlowState = Readonly<{
  pending: boolean;
  error?: string;
}>;

const genericError = "인증 정보를 확인할 수 없습니다.";

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: { message?: string };
    data?: Record<string, unknown>;
  };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message ?? genericError);
  }
  return payload.data;
}

export function VoterInviteExchangeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<VoterFlowState>({ pending: false });

  async function exchange(raw: string) {
    const token = raw.trim();
    if (!token) {
      setState({ pending: false, error: genericError });
      return;
    }
    setState({ pending: true });
    try {
      const data = await postJson("/api/v1/voter/invitations/verify", { invite_token: token });
      const requiresIdentifier = data?.requires_identifier !== false;
      router.push(requiresIdentifier ? "/voter/identify" : "/voter/election");
    } catch {
      setState({ pending: false, error: genericError });
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? params.get("invite_token");
    if (!token) {
      return;
    }
    window.history.replaceState(null, "", "/voter/invite");
    startTransition(() => {
      void exchange(token);
    });
  }, []);

  return (
    <form
      className="grid gap-4 rounded-md border border-slate-200 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void exchange(String(formData.get("invitation") ?? ""));
      }}
    >
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        초대 확인값
        <input
          name="invitation"
          type="password"
          autoComplete="one-time-code"
          className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="초대 화면에서 받은 값을 입력하세요"
        />
      </label>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={state.pending || isPending}
        className="min-h-12 w-full rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-400"
      >
        {state.pending || isPending ? "확인 중" : "초대 확인"}
      </button>
    </form>
  );
}

export function VoterIdentifierForm() {
  const router = useRouter();
  const [state, setState] = useState<VoterFlowState>({ pending: false });

  async function submit(formData: FormData) {
    const identifier = String(formData.get("externalIdentifier") ?? "").trim();
    if (!identifier) {
      setState({ pending: false, error: genericError });
      return;
    }
    setState({ pending: true });
    try {
      await postJson("/api/v1/voter/identifier/verify", { identifier });
      router.push("/voter/election");
    } catch {
      setState({ pending: false, error: genericError });
    }
  }

  return (
    <form
      className="grid gap-4 rounded-md border border-slate-200 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        이름
        <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base" autoComplete="name" />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        회원번호/사번/학번
        <input
          name="externalIdentifier"
          className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
          inputMode="text"
          autoComplete="off"
        />
      </label>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <p className="text-sm leading-6 text-slate-600">인증코드는 MVP 기본 흐름에서 사용하지 않습니다.</p>
      <button
        type="submit"
        disabled={state.pending}
        className="min-h-12 w-full rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-400"
      >
        {state.pending ? "확인 중" : "확인"}
      </button>
    </form>
  );
}
