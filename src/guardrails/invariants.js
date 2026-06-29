export const FORBIDDEN_ANONYMOUS_FIELDS_BY_TABLE = Object.freeze({
  ballots: Object.freeze([
    "user_id",
    "eligible_voter_id",
    "voting_credential_id",
    "voter_session_id"
  ]),
  votes: Object.freeze([
    "user_id",
    "eligible_voter_id",
    "voting_credential_id",
    "voter_session_id"
  ]),
  anonymous_ballot_groups: Object.freeze([
    "eligible_voter_id",
    "voting_credential_id",
    "voter_session_id"
  ]),
  submission_events: Object.freeze([
    "eligible_voter_id",
    "voting_credential_id",
    "voter_session_id"
  ]),
  credential_events: Object.freeze(["ballot_id", "anonymous_ballot_group_id"]),
  voter_sessions: Object.freeze([
    "ballot_id",
    "vote_id",
    "anonymous_ballot_group_id",
    "submission_event_id"
  ])
});

export const RANDOM_TOKEN_DERIVED_FIELDS = Object.freeze([
  "ballot_group_token_hash",
  "receipt_hash",
  "invite_token_hash"
]);

export const FORBIDDEN_LOG_VALUE_CLASSES = Object.freeze([
  "token_plaintext",
  "authentication_code_plaintext",
  "session_token",
  "step_up_handle_plaintext",
  "invite_token_plaintext",
  "sensitive_pii_plaintext"
]);

export const OFFICIAL_TALLY_BALLOT_CRITERIA = Object.freeze({
  is_current: true,
  acceptance_status: "accepted",
  server_received_at_lte: "election.ends_at"
});

export function findForbiddenAnonymousFields(tableColumnsByName) {
  return Object.entries(FORBIDDEN_ANONYMOUS_FIELDS_BY_TABLE).flatMap(
    ([tableName, forbiddenFields]) => {
      const columns = new Set(tableColumnsByName[tableName] ?? []);
      return forbiddenFields
        .filter((fieldName) => columns.has(fieldName))
        .map((fieldName) => ({ tableName, fieldName }));
    }
  );
}

export function assertNoForbiddenAnonymousFields(tableColumnsByName) {
  const violations = findForbiddenAnonymousFields(tableColumnsByName);
  if (violations.length > 0) {
    const formatted = violations
      .map(({ tableName, fieldName }) => `${tableName}.${fieldName}`)
      .join(", ");
    throw new Error(`Anonymous voting forbidden fields detected: ${formatted}`);
  }
}
