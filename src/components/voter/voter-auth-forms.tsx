"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { canonicalVoterIdentifier, validateVoterRegistryFields } from "../../lib/voter-registry-fields";

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
      className="ui-card grid gap-[18px] p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void exchange(String(formData.get("invitation") ?? ""));
      }}
    >
      <label className="grid gap-2 text-[13.5px] font-bold text-[#3A4A66]">
        초대 확인값
        <input
          name="invitation"
          type="password"
          autoComplete="one-time-code"
          className="text-base"
          placeholder="초대 화면에서 받은 값을 입력하세요"
        />
      </label>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={state.pending || isPending}
        className="ui-primary-button w-full text-base"
      >
        {state.pending || isPending ? "확인 중" : "초대 확인"}
      </button>
    </form>
  );
}

export function VoterIdentifierForm({
  useBirthDateForVerification = true
}: {
  useBirthDateForVerification?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<VoterFlowState>({ pending: false });

  async function submit(formData: FormData) {
    const fields = validateVoterRegistryFields({
      householdNumber: String(formData.get("householdNumber") ?? ""),
      name: String(formData.get("name") ?? ""),
      identifierLast4: String(formData.get("identifierLast4") ?? ""),
      birthDate6: String(formData.get("birthDate6") ?? "")
    }, { requireBirthDate: useBirthDateForVerification });
    if (!fields.ok || !fields.fields) {
      setState({ pending: false, error: genericError });
      return;
    }
    setState({ pending: true });
    try {
      await postJson("/api/v1/voter/identifier/verify", {
        identifier: canonicalVoterIdentifier(fields.fields, {
          includeBirthDate: useBirthDateForVerification
        })
      });
      router.push("/voter/election");
    } catch {
      setState({ pending: false, error: genericError });
    }
  }

  return (
    <form
      className="ui-card grid gap-[18px] p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <label className="grid gap-[7px] text-[13.5px] font-bold text-[#3A4A66]">
        호수번호
        <input
          name="householdNumber"
          required
          pattern="\d+"
          maxLength={8}
          className="text-base"
          inputMode="numeric"
          autoComplete="off"
          placeholder="예: 234"
        />
        <span className="text-xs font-normal leading-5 text-ink-faint">숫자만 적어주세요 (예: 2, 34, 52)</span>
      </label>
      <label className="grid gap-[7px] text-[13.5px] font-bold text-[#3A4A66]">
        이름
        <input
          name="name"
          required
          className="text-base"
          autoComplete="name"
          placeholder="예: 홍길동"
        />
        <span className="text-xs font-normal leading-5 text-ink-faint">한글이름을 빈칸없이 적어주세요 (예: 홍길동)</span>
      </label>
      <label className="grid gap-[7px] text-[13.5px] font-bold text-[#3A4A66]">
        식별번호
        <input
          name="identifierLast4"
          required
          pattern="\d{4}"
          maxLength={4}
          className="text-base"
          inputMode="numeric"
          autoComplete="off"
          placeholder="예: 1234"
        />
        <span className="text-xs font-normal leading-5 text-ink-faint">입주등록한 세대주의 전화번호 뒷 4자리</span>
      </label>
      {useBirthDateForVerification ? (
        <label className="grid gap-[7px] text-[13.5px] font-bold text-[#3A4A66]">
          생년월일
          <input
            name="birthDate6"
            required
            pattern="\d{6}"
            maxLength={6}
            className="text-base"
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 781207"
          />
          <span className="text-xs font-normal leading-5 text-ink-faint">6자리 연월일 (예: 781207)</span>
        </label>
      ) : null}
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={state.pending}
        className="ui-primary-button w-full text-base"
      >
        {state.pending ? "확인 중" : "확인"}
      </button>
    </form>
  );
}
