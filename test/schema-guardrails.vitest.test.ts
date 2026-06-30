import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  AuthenticationMethod,
  DEFAULT_AUTHENTICATION_METHOD,
  FORBIDDEN_ANONYMOUS_FIELDS_BY_TABLE,
  assertNoForbiddenAnonymousFields
} from "../src/guardrails/index.js";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migrationsDir = "prisma/migrations";

function allMigrationSql() {
  if (!existsSync(migrationsDir)) {
    return "";
  }
  return readdirSync(migrationsDir)
    .filter((entry) => entry !== "migration_lock.toml")
    .sort()
    .map((migrationFile) => readFileSync(`${migrationsDir}/${migrationFile}/migration.sql`, "utf8"))
    .join("\n");
}

function migrationTableBlock(migrationSql: string, tableName: string) {
  const match = migrationSql.match(
    new RegExp(`CREATE TABLE "${tableName}" \\(([\\s\\S]*?)\\n\\);`)
  );
  if (!match) {
    throw new Error(`migration table ${tableName} not found`);
  }
  return match[1];
}

function block(kind: "model" | "enum", name: string) {
  const match = schema.match(new RegExp(`${kind}\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`));
  if (!match) {
    throw new Error(`${kind} ${name} not found`);
  }
  return match[1];
}

function fieldLines(modelName: string) {
  return block("model", modelName)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"));
}

function fieldNames(modelName: string) {
  return fieldLines(modelName).map((line) => line.split(/\s+/)[0]);
}

function enumValues(enumName: string) {
  return block("enum", enumName)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"))
    .map((line) => line.split(/\s+/)[0]);
}

function tableNameForModel(modelName: string) {
  return block("model", modelName).match(/@@map\("([^"]+)"\)/)?.[1];
}

function columnNameForField(line: string) {
  const [fieldName] = line.split(/\s+/);
  return line.match(/@map\("([^"]+)"\)/)?.[1] ?? fieldName;
}

function columnsByTable(modelNames: string[]) {
  return Object.fromEntries(
    modelNames.map((modelName) => [
      tableNameForModel(modelName),
      fieldLines(modelName).map(columnNameForField)
    ])
  );
}

describe("Prisma schema guardrails", () => {
  it("does not contain anonymous voting forbidden fields", () => {
    const forbiddenModelFields: Record<string, string[]> = {
      Ballot: ["userId", "eligibleVoterId", "votingCredentialId", "voterSessionId"],
      Vote: ["userId", "eligibleVoterId", "votingCredentialId", "voterSessionId"],
      AnonymousBallotGroup: ["eligibleVoterId", "votingCredentialId", "voterSessionId"],
      SubmissionEvent: ["eligibleVoterId", "votingCredentialId", "voterSessionId"],
      CredentialEvent: ["ballotId", "anonymousBallotGroupId", "submissionEventId"],
      VoterSession: ["ballotId", "voteId", "anonymousBallotGroupId", "submissionEventId"]
    };

    for (const [modelName, forbiddenFields] of Object.entries(forbiddenModelFields)) {
      const fields = fieldNames(modelName);
      for (const forbiddenField of forbiddenFields) {
        expect(fields, `${modelName}.${forbiddenField}`).not.toContain(forbiddenField);
      }
    }

    assertNoForbiddenAnonymousFields(
      columnsByTable([
        "Ballot",
        "Vote",
        "AnonymousBallotGroup",
        "SubmissionEvent",
        "CredentialEvent",
        "VoterSession"
      ]) as Record<keyof typeof FORBIDDEN_ANONYMOUS_FIELDS_BY_TABLE, string[]>
    );
  });

  it("does not contain forbidden anonymous voting relations", () => {
    expect(block("model", "Ballot")).not.toMatch(
      /\b(User|EligibleVoter|VotingCredential|VoterSession)\b/
    );
    expect(block("model", "Vote")).not.toMatch(
      /\b(User|EligibleVoter|VotingCredential|VoterSession)\b/
    );
    expect(block("model", "AnonymousBallotGroup")).not.toMatch(
      /\b(User|EligibleVoter|VotingCredential|AnonymousVotingPass|VoterSession)\b/
    );
    expect(block("model", "SubmissionEvent")).not.toMatch(
      /\b(EligibleVoter|VotingCredential|VoterSession)\b/
    );
    expect(block("model", "CredentialEvent")).not.toMatch(
      /\b(Ballot|AnonymousBallotGroup|Vote|SubmissionEvent)\b/
    );
    expect(block("model", "VoterSession")).not.toMatch(
      /\b(Ballot|Vote|AnonymousBallotGroup|SubmissionEvent)\b/
    );
  });

  it("managed voter registries stay outside anonymous ballot models", () => {
    expect(block("model", "ManagedVoterRegistry")).toContain("organizationId");
    expect(block("model", "ManagedVoter")).toContain("externalIdentifierHmac");
    expect(block("model", "ManagedVoterRegistry")).not.toMatch(/\b(Ballot|Vote|AnonymousBallotGroup)\b/);
    expect(block("model", "ManagedVoter")).not.toMatch(/\b(Ballot|Vote|AnonymousBallotGroup)\b/);
    expect(block("model", "VoterRegistry")).toContain("managedRegistryId");
    expect(block("model", "VoterRegistry")).not.toMatch(/\bBallot\b|\bVote\b|\bAnonymousBallotGroup\b/);
  });

  it("contains VoterSession for short-lived voter auth sessions only", () => {
    const fields = fieldNames("VoterSession");
    expect(fields).toEqual(
      expect.arrayContaining([
        "id",
        "electionId",
        "eligibleVoterId",
        "votingCredentialId",
        "opaqueHandleHash",
        "authenticationMethod",
        "authenticated",
        "issuedAt",
        "expiresAt",
        "revokedAt",
        "lastUsedAt",
        "createdAt",
        "updatedAt"
      ])
    );
    expect(block("model", "VoterSession")).toMatch(/opaqueHandleHash\s+String/);
    expect(block("model", "VoterSession")).toContain("@unique @map(\"opaque_handle_hash\")");
    expect(block("model", "VoterSession")).toContain("@@index([expiresAt])");
    expect(block("model", "VoterSession")).toContain("@@index([electionId])");
    expect(block("model", "VoterSession")).toContain(
      "@@index([votingCredentialId, revokedAt, expiresAt])"
    );
    expect(block("model", "VoterSession")).toContain(
      "Never store raw invite tokens, raw session handles, session tokens, IP, or User-Agent here."
    );
  });

  it("contains AdminSession for admin auth sessions only", () => {
    const fields = fieldNames("AdminSession");
    expect(fields).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "sessionTokenHash",
        "issuedAt",
        "expiresAt",
        "revokedAt",
        "lastUsedAt",
        "createdAt",
        "updatedAt"
      ])
    );
    expect(block("model", "AdminSession")).toMatch(/sessionTokenHash\s+String/);
    expect(block("model", "AdminSession")).toContain("@unique @map(\"session_token_hash\")");
    expect(block("model", "AdminSession")).toContain(
      "Never store raw session tokens, passwords, IP, or User-Agent here."
    );
    expect(block("model", "AdminSession")).not.toMatch(
      /\b(Election|Ballot|Vote|AnonymousBallotGroup|VoterSession|VotingCredential|EligibleVoter)\b/
    );

    for (const forbiddenField of [
      "sessionToken",
      "rawSessionToken",
      "password",
      "passwordPlaintext",
      "ipAddress",
      "userAgent",
      "voterSessionId",
      "ballotId",
      "voteId",
      "anonymousBallotGroupId"
    ]) {
      expect(fields, `AdminSession.${forbiddenField}`).not.toContain(forbiddenField);
    }
  });

  it("contains AdminStepUpGrant for short-lived scoped step-up grants only", () => {
    const fields = fieldNames("AdminStepUpGrant");
    expect(fields).toEqual(
      expect.arrayContaining([
        "id",
        "adminSessionId",
        "userId",
        "tokenHash",
        "permissionCodes",
        "purpose",
        "verifiedAt",
        "expiresAt",
        "revokedAt",
        "createdAt",
        "updatedAt"
      ])
    );
    expect(block("model", "AdminStepUpGrant")).toMatch(/tokenHash\s+String/);
    expect(block("model", "AdminStepUpGrant")).toContain("@unique @map(\"token_hash\")");
    expect(block("model", "AdminStepUpGrant")).toMatch(/permissionCodes\s+Json/);
    expect(block("model", "AdminStepUpGrant")).toContain(
      "Never store raw step-up tokens, passwords, IP, or User-Agent here."
    );
    expect(block("model", "AdminStepUpGrant")).not.toMatch(
      /\b(Ballot|Vote|AnonymousBallotGroup|VoterSession|VotingCredential|EligibleVoter)\b/
    );

    for (const forbiddenField of [
      "stepUpToken",
      "rawStepUpToken",
      "password",
      "passwordPlaintext",
      "ipAddress",
      "userAgent",
      "voterSessionId",
      "ballotId",
      "voteId",
      "anonymousBallotGroupId"
    ]) {
      expect(fields, `AdminStepUpGrant.${forbiddenField}`).not.toContain(forbiddenField);
    }
  });

  it("keeps AuthenticationMethod canonical and MVP default safe", () => {
    expect(enumValues("AuthenticationMethod")).toEqual(Object.values(AuthenticationMethod));
    expect(DEFAULT_AUTHENTICATION_METHOD).toBe("invite_link_with_identifier");
    expect(block("model", "AuthenticationPolicy")).toMatch(
      /method\s+AuthenticationMethod\s+@default\(invite_link_with_identifier\)/
    );
  });

  it("keeps code authentication optional and outside VotingCredential", () => {
    const authPolicy = block("model", "AuthenticationPolicy");
    expect(authPolicy).toMatch(/codeChannel\s+String\?/);
    expect(authPolicy).toMatch(/codeTtlMinutes\s+Int\?/);
    expect(authPolicy).toMatch(/maxCodeResends\s+Int\?/);
    expect(block("model", "VotingCredential")).not.toMatch(/\bcode\w*\b/i);
  });

  it("keeps Ballot fields required for revote and official tally", () => {
    const fields = fieldNames("Ballot");
    expect(fields).toEqual(
      expect.arrayContaining(["isCurrent", "acceptanceStatus", "serverReceivedAt"])
    );
    expect(block("model", "Ballot")).toContain(
      "@@index([electionId, isCurrent, acceptanceStatus, serverReceivedAt])"
    );
  });

  it("contains result versioning and separated event models", () => {
    for (const modelName of [
      "ResultVersion",
      "AuditEvent",
      "SecurityEvent",
      "CredentialEvent",
      "SubmissionEvent"
    ]) {
      expect(() => block("model", modelName)).not.toThrow();
    }
  });

  it("stores token and authentication code values only as hashes or policy metadata", () => {
    const forbiddenPlainFields = [
      "inviteToken",
      "inviteTokenPlaintext",
      "ballotGroupToken",
      "authenticationCode",
      "authenticationCodePlaintext",
      "codePlaintext",
      "rawCode",
      "sessionToken",
      "voterSessionToken",
      "opaqueHandle",
      "rawSessionHandle",
      "inviteTokenRaw"
    ];

    for (const modelName of [
      "Invitation",
      "AnonymousBallotGroup",
      "CredentialEvent",
      "SubmissionEvent",
      "VotingCredential",
      "VoterSession",
      "AdminSession",
      "AdminStepUpGrant"
    ]) {
      const fields = fieldNames(modelName);
      for (const field of forbiddenPlainFields) {
        expect(fields, `${modelName}.${field}`).not.toContain(field);
      }
    }

    expect(fieldNames("Invitation")).toContain("inviteTokenHash");
    expect(fieldNames("AnonymousBallotGroup")).toContain("ballotGroupTokenHash");
    expect(fieldNames("AdminSession")).toContain("sessionTokenHash");
    expect(fieldNames("AdminStepUpGrant")).toContain("tokenHash");
  });

  it("keeps SecurityEventType generic and actorType-based for admin events", () => {
    const values = enumValues("SecurityEventType");
    expect(values).toEqual(
      expect.arrayContaining([
        "login_success",
        "login_failed",
        "step_up_success",
        "step_up_failed",
        "permission_denied"
      ])
    );
    expect(values).not.toContain("admin_login_success");
    expect(values).not.toContain("admin_login_failed");
    expect(values).not.toContain("admin_step_up_success");
    expect(values).not.toContain("admin_step_up_failed");
    expect(block("model", "SecurityEvent")).toMatch(/actorType\s+String/);
  });

  it("keeps migration SQL aligned with anonymous voting and token guardrails", () => {
    const migrationSql = allMigrationSql();
    expect(migrationSql).not.toBe("");
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "unique_current_ballot_per_group" ON "ballots"("anonymous_ballot_group_id") WHERE "is_current" = true;'
    );
    expect(migrationSql).toContain(
      "CREATE TYPE \"AuthenticationMethod\" AS ENUM ('invite_link_only', 'invite_link_with_identifier', 'email_code', 'sms_code', 'kakao_message', 'external_identity', 'sso', 'legal_strong_auth');"
    );

    const forbiddenColumnsByTable = {
      ballots: ["eligible_voter_id", "voting_credential_id", "user_id", "voter_session_id"],
      votes: ["eligible_voter_id", "voting_credential_id", "user_id", "voter_session_id"],
      anonymous_ballot_groups: ["eligible_voter_id", "voting_credential_id", "voter_session_id"],
      submission_events: ["eligible_voter_id", "voting_credential_id", "voter_session_id"],
      credential_events: ["ballot_id", "anonymous_ballot_group_id", "submission_event_id"],
      voter_sessions: ["ballot_id", "vote_id", "anonymous_ballot_group_id", "submission_event_id"]
    };

    for (const [tableName, columns] of Object.entries(forbiddenColumnsByTable)) {
      const tableSql = migrationTableBlock(migrationSql, tableName);
      for (const column of columns) {
        expect(tableSql, `${tableName}.${column}`).not.toContain(`"${column}"`);
      }
    }

    expect(migrationSql).not.toMatch(/\binvite_token\b/);
    expect(migrationSql).not.toMatch(/\bsession_token\b/);
    expect(migrationSql).not.toMatch(/\bauthentication_code\b/);
    expect(migrationSql).not.toMatch(/\bcode_plaintext\b/);
  });
});
