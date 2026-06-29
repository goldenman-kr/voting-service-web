import type { ReactNode } from "react";

export function WarningBanner({
  title = "주의가 필요한 작업입니다",
  children
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-amber-900">{children}</div>
    </section>
  );
}
