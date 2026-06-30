import Link from "next/link";

import { PublicNav } from "../components/ui/public-nav";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNav />
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-12">
        <div className="grid gap-6">
          <div>
            <p className="text-sm font-semibold text-blue-700">폐쇄형 명부 기반 온라인 투표</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              온라인 투표 사이트에 오신 것을 환영합니다.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
              투표하러 가기를 누르시고, 투표 안내에 따라 초대 확인과 선거인 명부 인증을 완료하면 투표할 수
              있습니다. 현재 MVP는 초대받은 유권자만 참여할 수 있는 방식으로 운영됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/voter" className="rounded-md bg-blue-700 px-5 py-3 text-sm font-semibold text-white">
              투표하러가기
            </Link>
            <Link
              href="/admin"
              className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800"
            >
              관리자 메뉴
            </Link>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid aspect-[4/3] place-items-center rounded-md border border-dashed border-blue-200 bg-blue-50 text-center">
            <div>
              <p className="text-sm font-semibold text-blue-800">투표 이미지 영역</p>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                실제 일러스트 또는 운영자가 승인한 이미지로 교체할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 md:grid-cols-3">
          <article className="rounded-md border border-slate-200 p-5">
            <h2 className="text-base font-semibold">이용 안내</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              투표 기간이 종료되면 공개 정책에 따라 결과를 확인할 수 있습니다. 투표 제출 정책은 투표별
              설정을 따르며, 현재 MVP는 마감 전 재투표를 지원할 수 있습니다.
            </p>
          </article>
          <article className="rounded-md border border-slate-200 p-5">
            <h2 className="text-base font-semibold">비밀투표 원칙</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              유권자 인증과 투표 제출은 분리되어 관리됩니다. 관리자도 특정 유권자의 선택 내용을 볼 수
              없도록 화면과 API 응답이 제한됩니다.
            </p>
          </article>
          <article className="rounded-md border border-slate-200 p-5">
            <h2 className="text-base font-semibold">신뢰성 보호</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              허가된 유권자만 참여할 수 있도록 선거인 명부와 초대 확인을 사용합니다. 결과는 공개 이후
              조용히 덮어쓰지 않고 이력으로 관리합니다.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-2">
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold">개인정보 보호</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            선거인명부와 개인정보는 보호된 저장소에서 관리하며, 화면에는 업무에 필요한 최소 정보만
            표시합니다. 토큰과 세션값은 화면, 문서, 로그에 노출하지 않습니다.
          </p>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold">오픈소스 검토</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            투표 시스템의 주요 동작 방식은 코드 검토를 전제로 관리합니다. 공개 저장소 링크는 운영 정책이
            확정된 뒤 연결합니다.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-slate-500">
            GitHub 저장소 링크 준비 중
          </span>
        </article>
      </section>
    </main>
  );
}
