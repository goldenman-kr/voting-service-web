import {
  DEFAULT_AUTHENTICATION_METHOD,
  ElectionState
} from "../guardrails/index.js";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-semibold text-brand-700">Voting Service</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            온라인 투표 서비스 기반 구조
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-700">
            Next.js, TypeScript, Prisma, Tailwind 기반 스캐폴딩이 준비되었습니다.
            이 화면은 Step 1.6의 placeholder이며 투표 기능을 구현하지 않습니다.
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-600">MVP 기본 인증</dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {DEFAULT_AUTHENTICATION_METHOD}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">초기 Election 상태</dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {ElectionState.DRAFT}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            관리자 포털
          </Link>
          <Link href="/voter/invite" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
            투표자 포털
          </Link>
        </div>
      </section>
    </main>
  );
}
