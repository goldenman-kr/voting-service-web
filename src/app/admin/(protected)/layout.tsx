import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin/admin-shell";
import { PermissionDeniedState } from "../../../components/ui/permission-denied-state";
import { getCurrentAdminSessionFromCookies } from "../../../server/auth/current-admin";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const restored = await getCurrentAdminSessionFromCookies();
  if (!restored) {
    redirect("/admin/login");
  }

  if (restored.session.permissions.length === 0) {
    return (
      <AdminShell admin={restored.session}>
        <PermissionDeniedState description="관리자 포털에 접근할 수 있는 Permission이 없습니다. 조직 관리자에게 Role 부여를 요청해 주세요." />
      </AdminShell>
    );
  }

  return <AdminShell admin={restored.session}>{children}</AdminShell>;
}
