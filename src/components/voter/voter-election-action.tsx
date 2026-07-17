"use client";

import Link from "next/link";
import { useState } from "react";

const endedMessage = "투표가 종료되어 관리자 결과 처리를 기다리고 있습니다.";

export function VoterElectionAction({
  href,
  label,
  ended,
  className
}: {
  href: string;
  label: string;
  ended?: boolean;
  className: string;
}) {
  const [showEndedDialog, setShowEndedDialog] = useState(false);

  if (!ended) {
    return <Link href={href} className={className}>{label}</Link>;
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setShowEndedDialog(true)}>
        본인 확인 후 투표하기
      </button>
      {showEndedDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voting-ended-dialog-title"
            className="ui-card grid w-full max-w-md gap-5 p-6 shadow-float"
          >
            <div>
              <p className="ui-eyebrow">투표 종료</p>
              <h2 id="voting-ended-dialog-title" className="mt-2 text-xl font-bold text-ink">
                관리자 결과 처리 대기 중입니다
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink-body">{endedMessage}</p>
            </div>
            <div className="flex justify-end">
              <button type="button" className="ui-primary-button" onClick={() => setShowEndedDialog(false)}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
