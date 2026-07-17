import Link from "next/link";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/#how", label: "이용 안내" },
  { href: "/#values", label: "원칙" },
  { href: "/admin", label: "관리자" }
];

export function VoteLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-ink-soft">
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-ink-soft text-white">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 12 2 2 4-4" />
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
        </svg>
      </span>
      <span className={compact ? "text-[15px] font-bold" : "text-[16.5px] font-bold tracking-[-0.01em]"}>
        온라인 투표
      </span>
    </span>
  );
}

export function PublicNav() {
  const navBadge = process.env.NEXT_PUBLIC_NAV_BADGE?.trim();

  return (
    <nav className="sticky top-0 z-50 border-b border-ink-soft/10 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-5 px-4 py-3.5 sm:px-8">
        <Link href="/" aria-label="온라인 투표 홈">
          <VoteLogo />
          {navBadge ? <span className="ml-2 text-sm font-medium text-amber-700">{navBadge}</span> : null}
        </Link>
        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3.5 py-2 text-[14.5px] font-semibold text-[#3A4A66] transition hover:bg-brand-50 hover:text-brand-800"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <Link href="/voter" className="ui-primary-button ml-1 min-h-[42px] px-4 py-2 text-[14.5px] sm:ml-2">
            투표하러가기
          </Link>
        </div>
      </div>
    </nav>
  );
}
