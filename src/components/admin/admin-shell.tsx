import Link from "next/link";
import type { ReactNode } from "react";

import type { AdminSession } from "../../server/auth/admin-session";
import { AdminLogoutButton } from "./admin-logout-button";

const navItems = [
  { href: "/admin/elections", label: "투표 관리" },
  { href: "/admin/elections/new", label: "투표 생성" }
];

function adminDisplayName(admin?: AdminSession): string {
  if (!admin) return "관리자";
  return `관리자 ...${admin.userId.slice(-6)}`;
}

export function AdminShell({ children, admin }: { children: ReactNode; admin?: AdminSession }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white p-4 lg:w-64 lg:border-b-0 lg:border-r">
          <Link href="/admin" className="block text-lg font-semibold">
            Voting Admin
          </Link>
          <p className="mt-1 text-xs text-slate-500">폐쇄형 명부 기반 투표 운영</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <Link href="/" className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">
              홈
            </Link>
            <Link href="/voter" className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">
              투표하러가기
            </Link>
          </div>
          {admin ? (
            <section className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">현재 사용자</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{adminDisplayName(admin)}</p>
              <p className="mt-1 text-xs text-slate-600">{admin.roles.join(", ")}</p>
              <p className="mt-1 text-xs text-slate-500">권한 {admin.permissions.length}개</p>
            </section>
          ) : null}
          <nav className="mt-6 flex gap-2 lg:flex-col">
            <Link
              href="/admin"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              대시보드
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
            <span className="rounded-md px-3 py-2 text-sm font-medium text-slate-400" title="공통 명부 관리는 후속 Phase에서 설계합니다.">
              선거인명부 관리
            </span>
          </nav>
          <div className="mt-6">
            <AdminLogoutButton />
          </div>
        </aside>
        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
