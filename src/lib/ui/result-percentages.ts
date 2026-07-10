export type ResultCountItem = Readonly<{
  question_id?: string | null;
  option_id?: string | null;
  display_label?: string | null;
  vote_count?: number;
}>;

export function formatPercent(numerator: number, denominator: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return "0%";
  }
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function isAbstainLabel(label?: string | null): boolean {
  return label === "기권" || label === "abstain";
}

export function resultItemVoteDenominators(
  items: readonly ResultCountItem[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (typeof item.vote_count !== "number" || isAbstainLabel(item.display_label)) {
      continue;
    }
    const key = item.question_id ?? "unknown";
    totals.set(key, (totals.get(key) ?? 0) + item.vote_count);
  }
  return totals;
}

export function formatResultVoteCount(
  item: ResultCountItem,
  denominators: ReadonlyMap<string, number>
): string {
  if (typeof item.vote_count !== "number") {
    return "비공개";
  }
  const denominator = denominators.get(item.question_id ?? "unknown") ?? 0;
  return `${item.vote_count}표 (${formatPercent(item.vote_count, denominator)})`;
}
