"use client";

import { FormEvent, useState } from "react";

export function StepUpPanel({
  permissionCodes,
  purpose
}: {
  permissionCodes: readonly string[];
  purpose: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage(null);
    setLoading(true);
    const form = new FormData(formElement);
    const password = String(form.get("password") ?? "");

    try {
      const response = await fetch("/api/v1/admin/auth/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, permissionCodes, purpose })
      });
      setMessage(response.ok ? "추가 인증이 완료되었습니다." : "추가 인증을 완료할 수 없습니다.");
    } catch {
      setMessage("추가 인증을 완료할 수 없습니다.");
    } finally {
      setLoading(false);
      formElement.reset();
    }
  }

  return (
    <section className="rounded-md border border-amber-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-950">위험 작업 추가 인증</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        위험 작업은 짧은 시간 동안 유효한 step-up 권한이 필요합니다. 토큰 값은 화면에 표시하지 않습니다.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          비밀번호 재확인
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            required
          />
        </label>
        <p className="text-xs text-slate-500">요청 권한: {permissionCodes.join(", ")}</p>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          {loading ? "확인 중" : "추가 인증"}
        </button>
      </form>
    </section>
  );
}
