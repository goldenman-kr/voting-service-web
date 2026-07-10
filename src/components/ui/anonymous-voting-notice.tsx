export function AnonymousVotingNotice({
  audience = "voter"
}: {
  audience?: "admin" | "voter";
}) {
  return (
    <section className="rounded-[14px] border border-brand-100 bg-brand-50 p-4 text-ink-soft">
      <h2 className="text-sm font-bold text-brand-800">익명투표 보호 안내</h2>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-ink-body">
        <li>투표자 신원과 선택 내용은 분리해서 처리합니다.</li>
        {audience === "admin" ? (
          <>
            <li>관리자 화면은 참여 현황을 집계 중심으로 표시합니다.</li>
            <li>특정 유권자의 선택 내용이나 제출 상세를 연결해 보여주지 않습니다.</li>
          </>
        ) : (
          <>
            <li>관리자도 특정 유권자의 선택 내용을 볼 수 없습니다.</li>
            <li>마감 전 다시 제출할 수 있지만 이전 선택 내용은 다시 표시하지 않습니다.</li>
          </>
        )}
      </ul>
    </section>
  );
}
