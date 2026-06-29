import {
  Exposure,
  GLOBAL_FORBIDDEN_FIELDS,
  SensitiveField,
  getFieldExposure
} from "../../guardrails/index.js";

export type RoleValue = string;
export type SensitiveFieldValue = (typeof SensitiveField)[keyof typeof SensitiveField];

const anonymousForbiddenFieldNames = new Set<string>([
  SensitiveField.BALLOT_ID,
  SensitiveField.VOTE_ID,
  SensitiveField.ANONYMOUS_BALLOT_GROUP_ID,
  SensitiveField.BALLOT_GROUP_TOKEN_HASH,
  "eligible_voter_id",
  "eligibleVoterId",
  "voting_credential_id",
  "votingCredentialId",
  "user_id",
  "userId",
  "ballot_id",
  "ballotId",
  "vote_id",
  "voteId",
  "anonymous_ballot_group_id",
  "anonymousBallotGroupId",
  "ballot_group_token_hash",
  "ballotGroupTokenHash"
]);

export function isFieldForbiddenForRole(role: RoleValue, field: SensitiveFieldValue): boolean {
  return getFieldExposure(role, field) === Exposure.FORBIDDEN;
}

export function isAnonymousVotingForbiddenField(field: string): boolean {
  return anonymousForbiddenFieldNames.has(field) || GLOBAL_FORBIDDEN_FIELDS[field] === Exposure.FORBIDDEN;
}

export type SanitizeContext = Readonly<{
  anonymousVoting?: boolean;
}>;

export function sanitizeResponseForRole<T extends Record<string, unknown>>(
  role: RoleValue,
  payload: T,
  context: SanitizeContext = {}
): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([field]) => {
      if (context.anonymousVoting && isAnonymousVotingForbiddenField(field)) {
        return false;
      }
      if ((Object.values(SensitiveField) as readonly string[]).includes(field)) {
        return !isFieldForbiddenForRole(role, field as SensitiveFieldValue);
      }
      return true;
    })
  ) as Partial<T>;
}
