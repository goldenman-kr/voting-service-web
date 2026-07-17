import { notFound } from "next/navigation";

import { PageHeader } from "../../../../../components/ui/page-header";
import { VoterIdentifierNotice } from "../../../../../components/ui/voter-identifier-notice";
import { VoterShell } from "../../../../../components/voter/voter-shell";
import { getPrismaClient } from "../../../../../server/db/prisma";
import { verifyListedElectionVoterAction } from "../../../../../server/voters/public-actions";

type Params = {
  params: Promise<{ election_id: string }> | { election_id: string };
  searchParams?: Promise<{ error?: string }> | { error?: string };
};

export default async function VoterElectionVerifyPage({ params, searchParams }: Params) {
  const electionId = (await params).election_id;
  const error = (await searchParams)?.error;
  const election = await getPrismaClient().election.findUnique({
    where: { id: electionId },
    select: { id: true, title: true, description: true, state: true }
  });
  if (!election || !["open", "closed", "tallying", "pending_confirmation", "confirmed", "published"].includes(election.state)) {
    notFound();
  }

  return (
    <VoterShell step={1}>
      <PageHeader
        eyebrow="선거인 확인"
        title={election.title}
        description={election.description ?? "선거인 명부 확인을 위해 호수번호, 이름, 식별번호, 생년월일을 입력합니다."}
        status={election.state}
      />
      <form action={verifyListedElectionVoterAction} className="ui-card grid gap-[18px] p-6">
        <input type="hidden" name="electionId" value={election.id} />
        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            인증 정보를 확인할 수 없습니다.
          </p>
        ) : null}
        <label className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-ink-body">
          <input name="privacyConsent" type="checkbox" required className="mt-1" />
          <span>
            개인정보 활용 동의: 입력한 정보는 투표 참여 자격 확인에만 사용되며 선거인 명부와 대조합니다.
          </span>
        </label>
        <label className="grid gap-2 text-[13.5px] font-bold text-[#3A4A66]">
          호수번호
          <input
            name="householdNumber"
            required
            pattern="\d+"
            maxLength={8}
            className="text-base"
            inputMode="numeric"
            autoComplete="off"
          />
          <span className="text-xs font-normal leading-5 text-slate-500">숫자만 적어주세요 (예: 2,34,52)</span>
        </label>
        <label className="grid gap-2 text-[13.5px] font-bold text-[#3A4A66]">
          이름
          <input
            name="name"
            required
            className="text-base"
            autoComplete="name"
          />
          <span className="text-xs font-normal leading-5 text-slate-500">한글이름을 빈칸없이 적어주세요 (예: 홍길동)</span>
        </label>
        <label className="grid gap-2 text-[13.5px] font-bold text-[#3A4A66]">
          식별번호
          <input
            name="identifierLast4"
            required
            pattern="\d{4}"
            maxLength={4}
            className="text-base"
            inputMode="numeric"
            autoComplete="off"
          />
          <span className="text-xs font-normal leading-5 text-slate-500">입주등록한 세대주의 전화번호 뒷4자리 (예: 1234)</span>
        </label>
        <label className="grid gap-2 text-[13.5px] font-bold text-[#3A4A66]">
          생년월일
          <input
            name="birthDate6"
            required
            pattern="\d{6}"
            maxLength={6}
            className="text-base"
            inputMode="numeric"
            autoComplete="off"
          />
          <span className="text-xs font-normal leading-5 text-slate-500">6자리 연월일 (예: 781207)</span>
        </label>
        <button type="submit" className="ui-primary-button text-base">
          확인
        </button>
      </form>
      <VoterIdentifierNotice />
    </VoterShell>
  );
}
