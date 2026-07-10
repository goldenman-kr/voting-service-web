"use client";

import { FormEvent, useState } from "react";

export function AdminLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const response = await fetch("/api/v1/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        setError("인증 정보를 확인할 수 없습니다.");
        return;
      }
      window.location.assign("/admin");
    } catch {
      setError("인증 정보를 확인할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="ui-card grid gap-4 p-6">
      <label className="grid gap-1.5 text-sm font-bold text-[#3A4A66]">
        계정명
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          className="text-base"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-[#3A4A66]">
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="text-base"
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="ui-primary-button"
      >
        {loading ? "확인 중" : "로그인"}
      </button>
    </form>
  );
}
