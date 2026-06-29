export function PrivacyNotice({
  compact = false
}: {
  compact?: boolean;
}) {
  return (
    <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950">
      <h2 className="text-sm font-semibold">개인정보 최소 노출</h2>
      <p className={compact ? "mt-2 text-sm text-blue-900" : "mt-2 text-sm leading-6 text-blue-900"}>
        화면에는 운영에 필요한 최소 정보만 표시합니다. 민감한 인증 값과 세션 값은 표시하지 않습니다.
      </p>
    </section>
  );
}
