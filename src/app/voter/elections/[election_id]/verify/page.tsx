import { notFound } from "next/navigation";

import { PageHeader } from "../../../../../components/ui/page-header";
import { PrivacyNotice } from "../../../../../components/ui/privacy-notice";
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
    <VoterShell>
      <PageHeader
        eyebrow="선거인 확인"
        title={election.title}
        description={election.description ?? "선거인 명부에 등록된 정보로 참여 자격을 확인합니다."}
        status={election.state}
      />
      <form action={verifyListedElectionVoterAction} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
        <input type="hidden" name="electionId" value={election.id} />
        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            인증 정보를 확인할 수 없습니다.
          </p>
        ) : null}
        <label className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <input name="privacyConsent" type="checkbox" required className="mt-1" />
          <span>개인정보 활용 동의: 투표 참여 자격 확인을 위해 입력한 정보를 선거인 명부와 대조하는 데 동의합니다.</span>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          이름
          <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base" autoComplete="name" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          회원번호/사번/학번
          <input
            name="externalIdentifier"
            required
            className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
            inputMode="text"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="min-h-12 rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white">
          확인
        </button>
      </form>
      <PrivacyNotice compact />
    </VoterShell>
  );
}
