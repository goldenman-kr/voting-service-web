import { createHmac, randomBytes } from "node:crypto";

export const BALLOT_GROUP_COOKIE_POLICY = Object.freeze({
  name: "anonymous_ballot_group",
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  tokenLogging: "forbidden"
});

export type BallotGroupTokenIssue = Readonly<{
  token: string;
  tokenHash: string;
}>;

export function hashBallotGroupToken(token: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(token).digest("hex");
}

export function createBallotGroupToken(hmacKey: string): BallotGroupTokenIssue {
  const token = randomBytes(32).toString("base64url");
  return Object.freeze({
    token,
    tokenHash: hashBallotGroupToken(token, hmacKey)
  });
}

export function assertBallotGroupTokenHashIsRandomTokenBased({
  tokenHash,
  hmacKey,
  forbiddenIdentifierValues
}: {
  tokenHash: string;
  hmacKey: string;
  forbiddenIdentifierValues: readonly string[];
}): void {
  const forbiddenHashes = forbiddenIdentifierValues.flatMap((value) => [
    value,
    hashBallotGroupToken(value, hmacKey)
  ]);
  if (forbiddenHashes.includes(tokenHash)) {
    throw new Error("ballotGroupTokenHash must not be derived from voter identifiers");
  }
}
