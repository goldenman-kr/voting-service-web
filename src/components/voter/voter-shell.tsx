import Link from "next/link";
import type { ReactNode } from "react";

import { VoteLogo } from "../ui/public-nav";

const steps = ["명부 인증", "투표", "검토", "완료"] as const;

export function VoterStepBar({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  return (
    <ol aria-label="투표 진행 단계" className="mb-1 flex items-start">
      {steps.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3 | 4;
        const complete = step < currentStep;
        const active = step === currentStep;
        return (
          <li key={label} className="contents">
            <div className="flex w-[68px] shrink-0 flex-col items-center gap-2 text-center sm:w-[76px]">
              <span
                className={[
                  "grid h-[34px] w-[34px] place-items-center rounded-full text-sm font-bold transition",
                  complete || active ? "bg-brand-600 text-white" : "bg-[#EAEEF5] text-[#9AA4B4]",
                  active ? "ring-4 ring-brand-600/15" : ""
                ].join(" ")}
              >
                {complete ? (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
                ) : step}
              </span>
              <span className={active ? "text-xs font-bold text-[#3A4A66]" : complete ? "text-xs font-semibold text-brand-600" : "text-xs font-semibold text-[#A6AEBC]"}>
                {label}
              </span>
            </div>
            {step < 4 ? <span className={complete ? "mt-4 h-0.5 flex-1 bg-brand-600" : "mt-4 h-0.5 flex-1 bg-[#E1E6EF]"} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function VoterShell({ children, step, wide = false }: { children: ReactNode; step?: 1 | 2 | 3 | 4; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <nav className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" aria-label="온라인 투표 홈"><VoteLogo compact /></Link>
          <Link href="/voter" className="rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-bold text-brand-600">투표자 포털</Link>
        </div>
      </nav>
      <div className={["mx-auto grid gap-5 px-4 pb-[72px] pt-8 sm:px-6", wide ? "max-w-[860px]" : "max-w-[640px]"].join(" ")}>
        {step ? <VoterStepBar currentStep={step} /> : null}
        {children}
      </div>
    </main>
  );
}

export function VoterPrimaryButton({ children }: { children: ReactNode }) {
  return <button className="ui-primary-button w-full text-base">{children}</button>;
}

export function VoterSecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="ui-secondary-button w-full text-base">{children}</Link>;
}
