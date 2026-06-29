export type ResultPrivacyRiskLevel = "low" | "medium" | "high";

export type ResultPrivacyItem = Readonly<{
  questionId: string;
  optionId?: string | null;
  voteCount: number;
  masked?: boolean;
  displayLabel?: string | null;
}>;

export type ResultPrivacyPolicyInput = Readonly<{
  votingMode: "anonymous" | "named";
  eligibleVoterCount: number;
  items: readonly ResultPrivacyItem[];
  minEligibleVotersForCounts?: number;
  minVotesPerOption?: number;
}>;

export type ResultPrivacyEvaluation = Readonly<{
  privacyRiskLevel: ResultPrivacyRiskLevel;
  canPublishCounts: boolean;
  maskedResultItems: readonly string[];
  requiredAction?: "none" | "mask_counts" | "block_counts";
}>;

const DEFAULT_MIN_ELIGIBLE_VOTERS_FOR_COUNTS = 10;
const DEFAULT_MIN_VOTES_PER_OPTION = 3;

function itemKey(item: ResultPrivacyItem): string {
  return `${item.questionId}:${item.optionId ?? item.displayLabel ?? "aggregate"}`;
}

export function evaluateAnonymousResultPrivacyRisk(
  input: ResultPrivacyPolicyInput
): ResultPrivacyEvaluation {
  if (input.votingMode !== "anonymous") {
    return Object.freeze({
      privacyRiskLevel: "low",
      canPublishCounts: true,
      maskedResultItems: Object.freeze([]),
      requiredAction: "none"
    });
  }

  const minEligibleVoters =
    input.minEligibleVotersForCounts ?? DEFAULT_MIN_ELIGIBLE_VOTERS_FOR_COUNTS;
  const minVotesPerOption = input.minVotesPerOption ?? DEFAULT_MIN_VOTES_PER_OPTION;

  if (input.eligibleVoterCount < minEligibleVoters) {
    return Object.freeze({
      privacyRiskLevel: "high",
      canPublishCounts: false,
      maskedResultItems: Object.freeze(input.items.map(itemKey)),
      requiredAction: "block_counts"
    });
  }

  const maskedResultItems = input.items
    .filter((item) => item.voteCount > 0 && item.voteCount < minVotesPerOption)
    .map(itemKey);

  return Object.freeze({
    privacyRiskLevel: maskedResultItems.length > 0 ? "medium" : "low",
    canPublishCounts: true,
    maskedResultItems: Object.freeze(maskedResultItems),
    requiredAction: maskedResultItems.length > 0 ? "mask_counts" : "none"
  });
}

export function canPublishResultCounts(input: ResultPrivacyPolicyInput): boolean {
  return evaluateAnonymousResultPrivacyRisk(input).canPublishCounts;
}

export function maskSmallGroupResultItems<T extends ResultPrivacyItem>(
  items: readonly T[],
  evaluation: ResultPrivacyEvaluation
): Array<T & { masked: boolean; publicVoteCount?: number }> {
  const maskedKeys = new Set(evaluation.maskedResultItems);
  const blockAllCounts = evaluation.requiredAction === "block_counts";

  return items.map((item) => {
    const masked = blockAllCounts || maskedKeys.has(itemKey(item)) || item.masked === true;
    return Object.freeze({
      ...item,
      masked,
      ...(masked ? {} : { publicVoteCount: item.voteCount })
    });
  });
}
