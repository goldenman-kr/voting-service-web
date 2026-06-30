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

export function evaluateAnonymousResultPrivacyRisk(
  _input: ResultPrivacyPolicyInput
): ResultPrivacyEvaluation {
  return Object.freeze({
    privacyRiskLevel: "low",
    canPublishCounts: true,
    maskedResultItems: Object.freeze([]),
    requiredAction: "none"
  });
}

export function canPublishResultCounts(input: ResultPrivacyPolicyInput): boolean {
  return evaluateAnonymousResultPrivacyRisk(input).canPublishCounts;
}

export function maskSmallGroupResultItems<T extends ResultPrivacyItem>(
  items: readonly T[],
  evaluation: ResultPrivacyEvaluation
): Array<T & { masked: boolean; publicVoteCount?: number }> {
  return items.map((item) =>
    Object.freeze({
      ...item,
      masked: false,
      publicVoteCount: item.voteCount
    })
  );
}
