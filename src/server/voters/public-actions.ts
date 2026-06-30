"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthStatus, CredentialEventType, CredentialStatus } from "@prisma/client";

import { getDefaultAuthenticationMethod } from "../../domain/auth-policy/authentication-policy";
import { parseEnv } from "../../lib/env";
import { VOTER_SESSION_COOKIE_POLICY, createVoterSession } from "../auth/voter-session";
import { getPrismaClient } from "../db/prisma";
import { hashVoterIdentifier } from "./voter-auth-service";

const completedStates = new Set(["closed", "tallying", "pending_confirmation", "confirmed", "published"]);

function genericVerifyFailure(electionId?: string): never {
  redirect(electionId ? `/voter/elections/${electionId}/verify?error=1` : "/voter");
}

export async function verifyListedElectionVoterAction(formData: FormData) {
  const electionId = String(formData.get("electionId") ?? "").trim();
  const identifier = String(formData.get("externalIdentifier") ?? "").trim();
  const consent = formData.get("privacyConsent") === "on";
  if (!electionId || !identifier || !consent) {
    genericVerifyFailure(electionId);
  }

  const env = parseEnv();
  const prisma = getPrismaClient();
  const externalIdentifierHmac = hashVoterIdentifier(identifier, env.HMAC_KEY);
  const eligibleVoter = await prisma.eligibleVoter.findFirst({
    where: {
      electionId,
      externalIdentifierHmac,
      status: "active"
    },
    select: {
      id: true,
      electionId: true,
      votingCredentials: {
        where: { electionId },
        take: 1,
        select: {
          id: true,
          credentialStatus: true,
          lockedUntil: true
        }
      },
      election: {
        select: {
          state: true,
          authenticationPolicy: {
            select: { method: true }
          }
        }
      }
    }
  });

  const credential = eligibleVoter?.votingCredentials[0];
  if (!eligibleVoter || !credential) {
    genericVerifyFailure(electionId);
  }
  if (
    credential.credentialStatus === CredentialStatus.locked ||
    credential.credentialStatus === CredentialStatus.revoked ||
    credential.credentialStatus === CredentialStatus.expired ||
    (credential.lockedUntil && credential.lockedUntil > new Date())
  ) {
    genericVerifyFailure(electionId);
  }

  const method = eligibleVoter.election.authenticationPolicy?.method ?? getDefaultAuthenticationMethod();
  const issued = createVoterSession({
    electionId: eligibleVoter.electionId,
    eligibleVoterId: eligibleVoter.id,
    votingCredentialId: credential.id,
    authenticationMethod: method,
    hmacKey: env.HMAC_KEY
  });

  await prisma.voterSession.create({
    data: {
      electionId: issued.session.electionId,
      eligibleVoterId: issued.session.eligibleVoterId,
      votingCredentialId: issued.session.votingCredentialId,
      opaqueHandleHash: issued.session.opaqueHandleHash,
      authenticationMethod: method,
      authenticated: true,
      identifierVerifiedAt: new Date(),
      step: AuthStatus.authenticated,
      issuedAt: issued.session.issuedAt,
      expiresAt: issued.session.expiresAt
    }
  });
  await prisma.votingCredential.update({
    where: { id: credential.id },
    data: {
      authStatus: AuthStatus.authenticated,
      identifierFailedAttempts: 0,
      lockedUntil: null,
      authenticatedAt: new Date()
    }
  });
  await prisma.credentialEvent.create({
    data: {
      electionId,
      votingCredentialId: credential.id,
      eventType: CredentialEventType.identifier_check_success,
      method,
      success: true
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(VOTER_SESSION_COOKIE_POLICY.name, issued.opaqueHandle, {
    httpOnly: VOTER_SESSION_COOKIE_POLICY.httpOnly,
    secure: VOTER_SESSION_COOKIE_POLICY.secure,
    sameSite: VOTER_SESSION_COOKIE_POLICY.sameSite,
    path: VOTER_SESSION_COOKIE_POLICY.path,
    expires: issued.session.expiresAt
  });

  if (eligibleVoter.election.state === "open") {
    redirect(`/voter/elections/${electionId}/ballot`);
  }
  if (completedStates.has(eligibleVoter.election.state)) {
    redirect(`/voter/elections/${electionId}/results`);
  }
  redirect("/voter");
}
