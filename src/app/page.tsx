import Image from "next/image";
import Link from "next/link";

import { PublicNav, VoteLogo } from "../components/ui/public-nav";

type IconName = "arrow" | "ballot" | "clock" | "code" | "eye-off" | "lock" | "mail" | "shield" | "user-check";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    ballot: <><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 2" /></>,
    code: <><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>,
    "eye-off": <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><path d="m3 3 18 18" /></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    "user-check": <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m17 11 2 2 3-3" /></>
  } satisfies Record<IconName, React.ReactNode>;

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

const steps = [
  { number: "01", icon: "mail" as const, title: "초대 확인", description: "받으신 초대 안내를 확인합니다. 허가된 유권자만 다음 단계로 진행할 수 있습니다." },
  { number: "02", icon: "user-check" as const, title: "선거인 명부 인증", description: "선거인 명부를 통해 본인 여부를 인증합니다. 인증 정보는 투표 내용과 분리되어 관리됩니다." },
  { number: "03", icon: "ballot" as const, title: "안전하게 투표", description: "안내에 따라 한 표를 행사합니다. 제출한 선택은 비밀투표 원칙에 따라 보호됩니다." }
];

const principles = [
  { icon: "eye-off" as const, title: "비밀투표 원칙", description: "유권자 인증과 투표 제출은 분리되어 관리됩니다. 관리자도 특정 유권자의 선택 내용을 볼 수 없습니다." },
  { icon: "shield" as const, title: "신뢰성 보호", description: "선거인 명부와 초대 확인으로 허가된 유권자만 참여합니다. 결과는 조용히 덮어쓰지 않고 이력으로 관리합니다." },
  { icon: "lock" as const, title: "개인정보 보호", description: "선거인명부와 개인정보는 보호된 저장소에서 관리하며, 화면에는 최소 정보만 표시합니다. 토큰과 세션값은 노출하지 않습니다." },
  { icon: "clock" as const, title: "투명한 운영", description: "공개 정책에 따라 결과를 확인할 수 있으며, 제출 정책은 투표별 설정을 명확히 따릅니다." }
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-white text-ink">
      <PublicNav />

      <header className="mx-auto grid w-full max-w-[1200px] gap-14 px-4 pb-14 pt-12 sm:px-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:pb-10 lg:pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3.5 py-2">
            <span className="h-[7px] w-[7px] rounded-full bg-brand-600" />
            <span className="text-[13px] font-bold tracking-[0.01em] text-brand-600">폐쇄형 명부 기반 온라인 투표</span>
          </div>
          <h1 className="mt-5 text-[40px] font-extrabold leading-[1.13] tracking-[-0.03em] text-ink sm:text-[48px] lg:text-[52px]">
            우리 동네의 결정,
            <br />
            <span className="text-brand-600">투명하고 안전하게</span>
            <br />
            한 표로 모읍니다.
          </h1>
          <p className="mt-5 max-w-[500px] text-[17px] leading-[1.72] text-ink-body sm:text-lg">
            초대 확인과 선거인 명부 인증만 마치면, 누구나 몇 분 안에 투표할 수 있습니다. 비밀투표 원칙에 따라 당신의 선택은 끝까지 안전하게 보호됩니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link href="/voter" className="ui-primary-button gap-2 px-6 text-base">
              투표하러가기 <Icon name="arrow" className="h-[18px] w-[18px]" />
            </Link>
            <Link href="#how" className="ui-secondary-button px-5 text-base">
              이용 방법 보기
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#3A4A66]">
            <span className="flex items-center gap-2"><Icon name="shield" className="h-[17px] w-[17px] text-gold" />명부 인증 기반 참여</span>
            <span className="flex items-center gap-2"><Icon name="eye-off" className="h-[17px] w-[17px] text-gold" />관리자도 못 보는 익명성</span>
            <span className="flex items-center gap-2"><Icon name="code" className="h-[17px] w-[17px] text-gold" />공개 소스로 검증</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[470px] px-4 pb-7 sm:px-0 lg:pb-0">
          <div className="absolute -right-3 -top-4 h-[130px] w-[130px] rounded-[26px] bg-[#E7EDFB]" />
          <div className="absolute -bottom-5 -left-1 h-[104px] w-[104px] rounded-[24px] bg-[#DDE8FA] sm:-left-5" />
          <div className="relative z-[1] aspect-[4/5] overflow-hidden rounded-[24px] border border-[#EEF1F6] shadow-hero">
            <Image src="/hero/bg1.png" alt="시골 주택마을 전경" fill priority sizes="(max-width: 1024px) 90vw, 470px" className="object-cover" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-ink/30 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 z-[3] h-[210px] w-[174px] overflow-hidden rounded-[20px] bg-white p-[7px] shadow-float sm:-bottom-6 sm:-left-7 sm:h-[230px] sm:w-[190px]">
            <div className="relative h-full w-full overflow-hidden rounded-[14px]">
              <Image src="/hero/bg2.png" alt="투표함에 투표용지를 넣는 손" fill sizes="190px" className="object-cover" />
            </div>
          </div>
          <div className="absolute right-0 top-7 z-[4] flex items-center gap-3 rounded-[15px] border border-ink-soft/5 bg-white px-4 py-3.5 shadow-[0_20px_40px_-16px_rgba(16,29,51,0.4)] sm:-right-5 sm:top-9">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-gold-tint text-gold-light"><Icon name="lock" className="h-[21px] w-[21px]" /></span>
            <span>
              <strong className="block text-sm font-bold text-ink">비밀투표 보장</strong>
              <span className="mt-0.5 block text-xs text-ink-muted">인증과 투표는 분리 관리</span>
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-[18px] bg-[#EAF0FA] px-6 py-5 text-[#34445F] sm:px-8">
          <span className="text-sm font-semibold tracking-[0.02em] text-[#657592]">신뢰 기반의 온라인 투표를 위해</span>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {["선거인 명부 인증", "초대 확인 절차", "결과 이력 관리", "오픈소스 공개"].map((item) => (
              <span key={item} className="flex items-center gap-2.5 text-[15px] font-semibold"><span className="text-[#7897CF]">●</span>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 pb-6 pt-20 sm:px-8">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="ui-eyebrow">이용 안내</p>
          <h2 className="mt-3 text-[32px] font-extrabold tracking-[-0.025em] text-ink sm:text-4xl">세 단계면 투표가 끝납니다</h2>
          <p className="mt-3.5 text-[17px] leading-7 text-[#5A6577]">처음이어도 어렵지 않습니다. 안내를 따라오시면 안전하게 한 표를 행사할 수 있습니다.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number} className="ui-card p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-[13px] bg-brand-50 text-brand-600"><Icon name={step.icon} className="h-6 w-6" /></span>
                <span className="text-[32px] font-extrabold tracking-[-0.02em] text-[#E4E9F2]">{step.number}</span>
              </div>
              <h3 className="mt-5 text-xl font-bold text-ink">{step.title}</h3>
              <p className="mt-2.5 text-[15px] leading-[1.7] text-[#5A6577]">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="values" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 pb-6 pt-[72px] sm:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-[52px]">
          <div className="lg:sticky lg:top-24">
            <p className="ui-eyebrow">우리의 원칙</p>
            <h2 className="mt-3 text-[32px] font-extrabold leading-[1.18] tracking-[-0.025em] text-ink sm:text-4xl">믿을 수 있는<br />투표를 만드는 약속</h2>
            <p className="mt-4 max-w-[360px] text-[17px] leading-[1.72] text-[#5A6577]">기술보다 신뢰가 먼저입니다. 참여하는 모든 주민이 안심할 수 있도록 네 가지 원칙을 지킵니다.</p>
          </div>
          <div className="grid gap-[18px] sm:grid-cols-2">
            {principles.map((principle) => (
              <article key={principle.title} className="rounded-card border border-line bg-white p-6">
                <span className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-gold-tint text-gold"><Icon name={principle.icon} className="h-[23px] w-[23px]" /></span>
                <h3 className="mt-[18px] text-lg font-bold text-ink">{principle.title}</h3>
                <p className="mt-2 text-[14.5px] leading-[1.68] text-[#5A6577]">{principle.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="vote" className="mx-auto w-full max-w-[760px] scroll-mt-24 px-4 py-20 text-center sm:px-8">
        <h2 className="text-[34px] font-extrabold tracking-[-0.03em] text-ink sm:text-[38px]">준비되셨나요?</h2>
        <p className="mx-auto mt-3 max-w-[560px] text-[16px] leading-7 text-[#5A6577]">지금 바로 초대 확인과 명부 인증을 시작하고, 소중한 한 표를 행사하세요.</p>
        <Link href="/voter" className="ui-primary-button mt-7 gap-2 px-6 text-base">투표하러가기 <Icon name="arrow" className="h-[18px] w-[18px]" /></Link>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-4 pb-14 sm:px-8">
        <div className="relative grid items-center gap-10 overflow-hidden rounded-[24px] bg-[#526785] px-7 py-11 text-white sm:px-14 lg:grid-cols-[1.3fr_1fr]">
          <div className="absolute -right-16 -top-16 h-[260px] w-[260px] rounded-full bg-white/10" />
          <div className="relative z-10">
            <span className="text-[13px] font-bold text-[#D5E1F5]">오픈소스 검토</span>
            <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.025em] sm:text-[32px]">숨기지 않습니다. 코드로 증명합니다.</h2>
            <p className="mt-3 max-w-[560px] text-[15px] leading-7 text-[#E1E8F2]">투표 시스템의 주요 동작 방식은 공개 저장소에서 누구나 확인할 수 있습니다. 코드와 변경 이력을 투명하게 관리해 운영 정책과 보안 원칙을 검증받습니다.</p>
          </div>
          <a href="https://github.com/goldenman-kr/voting-service-web" className="ui-secondary-button relative z-10 justify-self-start border-white bg-white text-ink lg:justify-self-center">
            <Icon name="code" className="mr-2 h-4 w-4" /> GitHub 저장소 보기
          </a>
        </div>
      </section>

      <footer className="mt-auto border-t border-line bg-canvas">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-8 text-sm sm:px-8 md:grid-cols-[1fr_auto_auto]">
          <div>
            <VoteLogo compact />
            <p className="mt-3 text-xs leading-5 text-ink-muted">폐쇄형 명부 기반 온라인 투표 서비스</p>
            <p className="text-xs leading-5 text-ink-muted">© 2026 KRYP. All rights reserved.</p>
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#3A4A66]">바로가기</h2>
            <div className="mt-2 grid gap-1 text-xs text-ink-muted"><Link href="/voter">투표하러가기</Link><Link href="#how">이용 안내</Link><Link href="/admin">관리자 메뉴</Link></div>
          </div>
          <div className="text-right text-sm">
            <h2 className="text-left text-xs font-bold text-[#3A4A66] md:text-right">문의</h2>
            <p className="mt-2 text-xs leading-5 text-ink-muted">온라인 선거시스템 문의: hello@kryp.xyz</p>
            <p className="text-xs leading-5 text-ink-muted">기술지원: kryp.xyz</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
