export function VoterIdentifierNotice() {
  return (
    <section className="rounded-[14px] border border-line bg-surface p-4 text-ink-soft">
      <h2 className="text-sm font-bold text-gold">안전한 유권자 확인</h2>
      <p className="mt-2 text-sm leading-6 text-ink-body">
        입력하신 인증 정보는 투표 내용과 분리되어 관리됩니다. 식별번호는 세대주의 전화번호 뒷 4자리이며,
        5회 실패 시 15분 동안 다시 시도할 수 없습니다. 명부 로그인이 안 될 경우 선거위원에게 문의하세요.
      </p>
    </section>
  );
}
