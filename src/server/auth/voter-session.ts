import { createHmac, randomBytes } from "node:crypto";

import type { AuthenticationMethodValue } from "../../domain/auth-policy/authentication-policy";

export type VoterSession = Readonly<{
  sessionId: string;
  opaqueHandleHash: string;
  electionId: string;
  eligibleVoterId: string;
  votingCredentialId: string;
  authenticationMethod: AuthenticationMethodValue;
  authenticated: boolean;
  issuedAt: Date;
  expiresAt: Date;
}>;

export type VoterSessionIssueResult = Readonly<{
  session: VoterSession;
  opaqueHandle: string;
}>;

export const VOTER_SESSION_COOKIE_POLICY = Object.freeze({
  name: "voter_session",
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  tokenLogging: "forbidden"
});

export function hashOpaqueHandle(handle: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(handle).digest("hex");
}

export function createVoterSession({
  electionId,
  eligibleVoterId,
  votingCredentialId,
  authenticationMethod,
  hmacKey,
  now = new Date(),
  ttlMinutes = 15
}: {
  electionId: string;
  eligibleVoterId: string;
  votingCredentialId: string;
  authenticationMethod: AuthenticationMethodValue;
  hmacKey: string;
  now?: Date;
  ttlMinutes?: number;
}): VoterSessionIssueResult {
  const opaqueHandle = randomBytes(32).toString("base64url");
  const sessionId = randomBytes(16).toString("hex");
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

  return Object.freeze({
    opaqueHandle,
    session: Object.freeze({
      sessionId,
      opaqueHandleHash: hashOpaqueHandle(opaqueHandle, hmacKey),
      electionId,
      eligibleVoterId,
      votingCredentialId,
      authenticationMethod,
      authenticated: false,
      issuedAt: now,
      expiresAt
    })
  });
}

export function assertVoterSessionContainsNoBallotIdentifiers(session: VoterSession): void {
  const serialized = JSON.stringify(session);
  if (
    /ballotId|voteId|anonymousBallotGroupId|submissionEventId|ballot_group_token_hash|ballotGroupTokenHash/.test(
      serialized
    )
  ) {
    throw new Error("Voter session must not contain Ballot/Vote identifiers");
  }
}
