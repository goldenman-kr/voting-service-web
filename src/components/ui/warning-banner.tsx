import type { ReactNode } from "react";

export function WarningBanner({
  title = "주의가 필요한 작업입니다",
  children
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-warning-200 bg-warning-50 p-4 text-warning-700">
      <h2 className="text-sm font-bold text-warning-600">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-warning-700">{children}</div>
    </section>
  );
}
