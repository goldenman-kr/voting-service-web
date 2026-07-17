import { redirect } from "next/navigation";

import { AdminLoginForm } from "../../../components/admin/admin-login-form";
import { PrivacyNotice } from "../../../components/ui/privacy-notice";
import { PublicNav } from "../../../components/ui/public-nav";
import { getCurrentAdminSessionFromCookies } from "../../../server/auth/current-admin";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const restored = await getCurrentAdminSessionFromCookies();
  if (restored) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <PublicNav />
      <div className="mx-auto grid max-w-md gap-5 px-4 py-10">
        <header>
          <p className="ui-eyebrow">관리자 인증</p>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.025em]">관리자 로그인</h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            관리자 계정으로 로그인합니다. 실패 사유는 보안을 위해 일반 안내로만 표시됩니다.
          </p>
        </header>
        <AdminLoginForm />
        <PrivacyNotice compact />
      </div>
    </main>
  );
}
