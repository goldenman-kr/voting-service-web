import test from "node:test";
import assert from "node:assert/strict";

import {
  AuthenticationMethod,
  CODE_AUTHENTICATION_METHODS,
  DEFAULT_AUTHENTICATION_METHOD,
  ElectionState,
  Exposure,
  FIELD_EXPOSURE_BY_ROLE,
  FORBIDDEN_ANONYMOUS_FIELDS_BY_TABLE,
  PERMISSION_BY_CODE,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  RiskLevel,
  Role,
  SensitiveField,
  assertNoForbiddenAnonymousFields,
  getFieldExposure
} from "../src/guardrails/index.js";

test("authentication policy defaults remain MVP-safe and code auth is optional", () => {
  assert.equal(
    DEFAULT_AUTHENTICATION_METHOD,
    AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
  );
  assert.deepEqual(Object.values(AuthenticationMethod), [
    "invite_link_only",
    "invite_link_with_identifier",
    "email_code",
    "sms_code",
    "kakao_message",
    "external_identity",
    "sso",
    "legal_strong_auth"
  ]);
  assert.deepEqual(CODE_AUTHENTICATION_METHODS, [
    AuthenticationMethod.EMAIL_CODE,
    AuthenticationMethod.SMS_CODE,
    AuthenticationMethod.KAKAO_MESSAGE
  ]);
  assert.ok(!CODE_AUTHENTICATION_METHODS.includes(DEFAULT_AUTHENTICATION_METHOD));
});

test("election state enum contains the approved lifecycle", () => {
  assert.deepEqual(Object.values(ElectionState), [
    "draft",
    "ready_for_review",
    "approved",
    "scheduled",
    "notice",
    "open",
    "paused",
    "closed",
    "tallying",
    "pending_confirmation",
    "confirmed",
    "published",
    "archived",
    "invalidated"
  ]);
});

test("all role mapping permissions exist", () => {
  const knownCodes = new Set(PERMISSIONS.map(({ code }) => code));
  for (const [role, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionCode of permissionCodes) {
      assert.ok(
        knownCodes.has(permissionCode),
        `${role} references unknown permission ${permissionCode}`
      );
    }
  }
});

test("critical export and DB access permissions require strict controls", () => {
  for (const permissionCode of [
    "log.export.request",
    "log.export.approve",
    "log.export.download",
    "db_access.request",
    "db_access.approve"
  ]) {
    const permission = PERMISSION_BY_CODE[permissionCode];
    assert.equal(permission.risk, RiskLevel.CRITICAL);
    assert.equal(permission.stepUp, "yes");
    assert.equal(permission.reason, "yes");
    assert.equal(permission.dualApproval, "yes");
    assert.equal(permission.auditEvent, true);
  }
});

test("anonymous voting forbidden fields are fixed", () => {
  assert.deepEqual(FORBIDDEN_ANONYMOUS_FIELDS_BY_TABLE, {
    ballots: ["user_id", "eligible_voter_id", "voting_credential_id", "voter_session_id"],
    votes: ["user_id", "eligible_voter_id", "voting_credential_id", "voter_session_id"],
    anonymous_ballot_groups: [
      "eligible_voter_id",
      "voting_credential_id",
      "voter_session_id"
    ],
    submission_events: ["eligible_voter_id", "voting_credential_id", "voter_session_id"],
    credential_events: ["ballot_id", "anonymous_ballot_group_id"],
    voter_sessions: [
      "ballot_id",
      "vote_id",
      "anonymous_ballot_group_id",
      "submission_event_id"
    ]
  });

  assertNoForbiddenAnonymousFields({
    ballots: [
      "id",
      "election_id",
      "anonymous_ballot_group_id",
      "submission_status",
      "acceptance_status",
      "server_received_at",
      "is_current"
    ],
    votes: ["id", "ballot_id", "question_id", "answer_type"],
    anonymous_ballot_groups: [
      "id",
      "election_id",
      "ballot_group_token_hash",
      "current_ballot_id"
    ],
    submission_events: ["id", "election_id", "ballot_id", "event_type"],
    credential_events: ["id", "election_id", "voting_credential_id", "event_type"],
    voter_sessions: [
      "id",
      "election_id",
      "eligible_voter_id",
      "voting_credential_id",
      "opaque_handle_hash"
    ]
  });

  assert.throws(
    () =>
      assertNoForbiddenAnonymousFields({
        ballots: ["id", "eligible_voter_id"]
      }),
    /ballots\.eligible_voter_id/
  );
});

test("field policy never exposes anonymous linkage identifiers", () => {
  for (const role of Object.values(Role)) {
    for (const field of [
      SensitiveField.BALLOT_ID,
      SensitiveField.VOTE_ID,
      SensitiveField.ANONYMOUS_BALLOT_GROUP_ID,
      SensitiveField.BALLOT_GROUP_TOKEN_HASH
    ]) {
      assert.equal(getFieldExposure(role, field), Exposure.FORBIDDEN, `${role}.${field}`);
    }
  }
});

test("general admin roles cannot view detailed submission metadata", () => {
  for (const role of [
    Role.ELECTION_MANAGER,
    Role.ELECTION_APPROVER,
    Role.ORGANIZATION_OWNER,
    Role.RESULT_PUBLISHER
  ]) {
    assert.equal(getFieldExposure(role, SensitiveField.DETAILED_SUBMITTED_AT), Exposure.FORBIDDEN);
    assert.equal(getFieldExposure(role, SensitiveField.IP), Exposure.FORBIDDEN);
    assert.equal(getFieldExposure(role, SensitiveField.USER_AGENT), Exposure.FORBIDDEN);
  }
});

test("voter can only see limited self completion fields", () => {
  assert.equal(getFieldExposure(Role.VOTER, SensitiveField.RECEIPT_PREVIEW), Exposure.SELF_ONLY);
  assert.equal(getFieldExposure(Role.VOTER, SensitiveField.BALLOT_ID), Exposure.FORBIDDEN);
  assert.equal(getFieldExposure(Role.VOTER, SensitiveField.VOTE_ID), Exposure.FORBIDDEN);
});

test("every role has an explicit field policy object", () => {
  for (const role of Object.values(Role)) {
    assert.ok(FIELD_EXPOSURE_BY_ROLE[role], `missing field policy for ${role}`);
  }
});
