"use client";

import { useState } from "react";

export function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/v1/admin/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/admin/login");
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="ui-secondary-button min-h-[42px] w-full py-2 text-sm"
    >
      {loading ? "로그아웃 중" : "로그아웃"}
    </button>
  );
}
