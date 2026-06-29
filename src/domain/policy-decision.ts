export const PolicyDecision = {
  ALLOWED: "allowed",
  DENIED: "denied",
  REQUIRES_PERMISSION: "requiresPermission",
  REQUIRES_REASON: "requiresReason",
  REQUIRES_STEP_UP: "requiresStepUp",
  REQUIRES_DUAL_APPROVAL: "requiresDualApproval"
} as const;

export type PolicyDecision = (typeof PolicyDecision)[keyof typeof PolicyDecision];

const decisionRank: Record<PolicyDecision, number> = {
  [PolicyDecision.ALLOWED]: 0,
  [PolicyDecision.REQUIRES_PERMISSION]: 1,
  [PolicyDecision.REQUIRES_REASON]: 2,
  [PolicyDecision.REQUIRES_STEP_UP]: 3,
  [PolicyDecision.REQUIRES_DUAL_APPROVAL]: 4,
  [PolicyDecision.DENIED]: 5
};

export function mostRestrictiveDecision(decisions: PolicyDecision[]): PolicyDecision {
  return decisions.reduce(
    (selected, decision) =>
      decisionRank[decision] > decisionRank[selected] ? decision : selected,
    PolicyDecision.ALLOWED
  );
}
