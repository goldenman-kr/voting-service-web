"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { AdminSession } from "../../server/auth/admin-session";
import { VoteLogo } from "../ui/public-nav";
import { AdminLogoutButton } from "./admin-logout-button";

const navItems = [
  { href: "/admin", label: "대시보드", icon: "dashboard" },
  { href: "/admin/elections", label: "투표 관리", icon: "ballot" },
  { href: "/admin/elections/new", label: "투표 생성", icon: "plus" },
  { href: "/admin/voter-registries", label: "선거인명부 관리", icon: "users" }
] as const;

function NavIcon({ name }: { name: (typeof navItems)[number]["icon"] }) {
  const path = name === "dashboard"
    ? <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>
    : name === "ballot"
      ? <><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>
      : name === "plus"
        ? <><path d="M12 5v14" /><path d="M5 12h14" /></>
        : <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>;
  return <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}

function adminDisplayName(admin?: AdminSession): string {
  if (!admin) return "관리자";
  return `관리자 ...${admin.userId.slice(-6)}`;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/elections") return pathname.startsWith(href) && pathname !== "/admin/elections/new";
  return pathname.startsWith(href);
}

export function AdminShell({ children, admin }: { children: ReactNode; admin?: AdminSession }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col lg:flex-row">
        <aside className="flex flex-col border-b border-line bg-white p-5 lg:sticky lg:top-0 lg:h-screen lg:w-[262px] lg:shrink-0 lg:border-b-0 lg:border-r lg:p-6">
          <Link href="/admin" className="block"><VoteLogo /></Link>
          <p className="mt-2 text-xs text-ink-faint">폐쇄형 명부 기반 투표 운영</p>

          {admin ? (
            <section className="mt-6 rounded-xl border border-line bg-surface p-3.5">
              <p className="text-[11px] font-bold tracking-[0.04em] text-ink-faint">현재 사용자</p>
              <p className="mt-1.5 text-sm font-bold text-ink">{adminDisplayName(admin)}</p>
              <p className="mt-1 break-words text-xs leading-5 text-ink-muted">{admin.roles.join(", ")}</p>
              <p className="mt-1 text-xs text-brand-600">권한 {admin.permissions.length}개</p>
            </section>
          ) : null}

          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex shrink-0 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition",
                    active ? "bg-brand-50 font-bold text-[#3E5BC0]" : "font-semibold text-[#5A6577] hover:bg-surface hover:text-ink"
                  ].join(" ")}
                >
                  <NavIcon name={item.icon} /> {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-line pt-5 lg:mt-auto">
            <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
              <Link href="/" className="rounded-lg px-2 py-1.5 hover:bg-surface">홈</Link>
              <Link href="/voter" className="rounded-lg px-2 py-1.5 hover:bg-surface">투표하러가기</Link>
            </div>
            <AdminLogoutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-9">{children}</main>
      </div>
    </div>
  );
}
