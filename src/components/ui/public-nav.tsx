import Link from "next/link";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/voter", label: "투표하러가기" },
  { href: "/admin", label: "관리자 메뉴" }
];

export function PublicNav() {
  return (
    <nav className="border-b border-slate-200 bg-white/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-base font-semibold text-slate-950">
          온라인 투표
        </Link>
        <div className="flex flex-wrap gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
