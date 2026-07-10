export type StateHistoryTableRow = Readonly<{
  label: string;
  changedAt: Date;
}>;

export function formatStateHistoryDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}.${byType.month}.${byType.day} ${byType.dayPeriod} ${byType.hour}:${byType.minute}`;
}

export function StateHistoryTable({
  title,
  rows,
  emptyMessage
}: {
  title: string;
  rows: readonly StateHistoryTableRow[];
  emptyMessage: string;
}) {
  return (
    <section className="ui-card grid gap-3 p-5">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <tbody className="divide-y divide-line">
              {rows.map((row, index) => (
                <tr key={`${row.label}-${row.changedAt.toISOString()}-${index}`}>
                  <th scope="row" className="w-1/2 py-3 pr-4 text-left font-bold text-[#3A4A66]">
                    {row.label}
                  </th>
                  <td className="py-3 text-ink-body">{formatStateHistoryDate(row.changedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm text-ink-muted">{emptyMessage}</p>
      )}
    </section>
  );
}
