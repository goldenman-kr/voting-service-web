export function AuditNotice({
  eventType = "위험 작업",
  riskLevel = "high"
}: {
  eventType?: string;
  riskLevel?: "medium" | "high" | "critical";
}) {
  const label = riskLevel === "critical" ? "매우 높음" : riskLevel === "high" ? "높음" : "중간";
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 text-slate-800">
      <h2 className="text-sm font-semibold text-slate-950">감사 기록 안내</h2>
      <p className="mt-2 text-sm leading-6">
        {eventType} 작업은 사유, 요청자, 시각, 변경 요약을 감사 기록으로 남깁니다. 위험도:
        <span className="ml-1 font-semibold">{label}</span>
      </p>
    </section>
  );
}
