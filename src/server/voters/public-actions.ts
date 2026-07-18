"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthStatus, CredentialEventType, CredentialStatus } from "@prisma/client";

import { getDefaultAuthenticationMethod } from "../../domain/auth-policy/authentication-policy";
import { isAwaitingAdminResultProcessing, isVotingWindowOpen } from "../../domain/elections/voting-window";
import { parseEnv } from "../../lib/env";
import { canonicalVoterIdentifier, validateVoterRegistryFields } from "../../lib/voter-registry-fields";
import { VOTER_SESSION_COOKIE_POLICY, createVoterSession } from "../auth/voter-session";
import { getPrismaClient } from "../db/prisma";
import { hashVoterIdentifier } from "./voter-auth-service";

const completedStates = new Set(["closed", "tallying", "pending_confirmation", "confirmed", "published"]);

function genericVerifyFailure(electionId?: string): never {
  redirect(electionId ? `/voter/elections/${electionId}/verify?error=1` : "/voter");
}

export async function verifyListedElectionVoterAction(formData: FormData) {
  const electionId = String(formData.get("electionId") ?? "").trim();
  const prisma = getPrismaClient();
  const registry = electionId
    ? await prisma.voterRegistry.findUnique({
        where: { electionId },
        select: { useBirthDateForVerification: true }
      })
    : null;
  const useBirthDateForVerification = registry?.useBirthDateForVerification !== false;
  const registryFields = validateVoterRegistryFields({
    householdNumber: String(formData.get("householdNumber") ?? ""),
    name: String(formData.get("name") ?? ""),
    identifierLast4: String(formData.get("identifierLast4") ?? ""),
    birthDate6: String(formData.get("birthDate6") ?? "")
  }, { requireBirthDate: useBirthDateForVerification });
  const consent = formData.get("privacyConsent") === "on";
  if (!electionId || !registryFields.ok || !registryFields.fields || !consent) {
    genericVerifyFailure(electionId);
  }

  const env = parseEnv();
  const identifierHmac = hashVoterIdentifier(
    canonicalVoterIdentifier(registryFields.fields, {
      includeBirthDate: useBirthDateForVerification
    }),
    env.HMAC_KEY
  );
  const eligibleVoter = await prisma.eligibleVoter.findFirst({
    where: {
      electionId,
      ...(useBirthDateForVerification
        ? { externalIdentifierHmac: identifierHmac }
        : { searchHmac: identifierHmac }),
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
          endsAt: true,
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
  const now = new Date();
  if (isAwaitingAdminResultProcessing(eligibleVoter.election, now)) {
    redirect("/voter?ended=1");
  }
  if (
    credential.credentialStatus === CredentialStatus.locked ||
    credential.credentialStatus === CredentialStatus.revoked ||
    credential.credentialStatus === CredentialStatus.expired ||
    (credential.lockedUntil && credential.lockedUntil > now)
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
      identifierVerifiedAt: now,
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
      authenticatedAt: now
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

  if (isVotingWindowOpen(eligibleVoter.election, now)) {
    redirect(`/voter/elections/${electionId}/ballot`);
  }
  if (completedStates.has(eligibleVoter.election.state)) {
    redirect(`/voter/elections/${electionId}/results`);
  }
  redirect("/voter");
}
