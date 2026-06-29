import Link from "next/link";
import type { ReactNode } from "react";

export function VoterShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950">
      <div className="mx-auto grid max-w-md gap-5">
        <header className="flex items-center justify-between">
          <Link href="/voter/invite" className="text-base font-semibold">
            Voting
          </Link>
          <span className="text-xs font-medium text-slate-500">모바일 우선</span>
        </header>
        {children}
      </div>
    </main>
  );
}

export function VoterPrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button className="min-h-12 w-full rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white">
      {children}
    </button>
  );
}

export function VoterSecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800"
    >
      {children}
    </Link>
  );
}
