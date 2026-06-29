import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  AuthenticationMethod,
  CredentialEventType,
  DEFAULT_AUTHENTICATION_METHOD
} from "../../src/guardrails/index.js";
import {
  getDefaultAuthenticationMethod,
  requiresIdentifier,
  requiresOneTimeCode
} from "../../src/domain/auth-policy/authentication-policy";
import { normalizeApiError } from "../../src/server/http/errors";
import {
  VOTER_SESSION_COOKIE_POLICY,
  assertVoterSessionContainsNoBallotIdentifiers,
  hashOpaqueHandle
} from "../../src/server/auth/voter-session";
import { handleIdentifierVerifyRoute, handleInvitationVerifyRoute } from "../../src/server/voters/route-handlers";
import { PrismaVoterAuthRepository } from "../../src/server/voters/prisma-repository";
import type { SecurityEventInput } from "../../src/server/audit/security-event";
import {
  canRequestOneTimeCode,
  hashInviteToken,
  hashVoterIdentifier,
  requestOneTimeCode,
  verifyInvitationToken,
  verifyVoterIdentifier
} from "../../src/server/voters/voter-auth-service";
import type {
  CredentialEventInput,
  CredentialUpdateCommand,
  InvitationAuthRecord,
  VoterAuthRepository,
  VoterSessionAuthenticationCommand,
  VoterSessionRecord,
  VotingCredentialAuthRecord
} from "../../src/server/voters/types";

const hmacKey = "test-hmac-key-with-at-least-32-chars";
const now = new Date("2026-01-01T00:00:00.000Z");

class InMemoryVoterAuthRepository implements VoterAuthRepository {
  invitations = new Map<string, InvitationAuthRecord>();
  credentials = new Map<string, VotingCredentialAuthRecord>();
  events: CredentialEventInput[] = [];
  securityEvents: SecurityEventInput[] = [];
  updates: CredentialUpdateCommand[] = [];
  sessionAuthUpdates: VoterSessionAuthenticationCommand[] = [];
  revokedSessionHashes: string[] = [];
  touchedSessionHashes: string[] = [];
  sessions = new Map<string, VoterSessionRecord>();

  async findInvitationByTokenHash(tokenHash: string) {
    return this.invitations.get(tokenHash) ?? null;
  }

  async findAuthenticationPolicy(electionId: string) {
    return {
      electionId,
      method: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER,
      isEnabled: true,
      isPaidMethod: false,
      provider: null
    };
  }

  async findVotingCredential(id: string) {
    return this.credentials.get(id) ?? null;
  }

  async updateVotingCredential(command: CredentialUpdateCommand) {
    this.updates.push(command);
  }

  async recordCredentialEvent(event: CredentialEventInput) {
    this.events.push(event);
  }

  async recordSecurityEvent(event: SecurityEventInput) {
    this.securityEvents.push(event);
  }

  async createVoterSessionRecord(session: VoterSessionRecord) {
    this.sessions.set(session.opaqueHandleHash, session);
  }

  async storeVoterSession(session: VoterSessionRecord) {
    await this.createVoterSessionRecord(session);
  }

  async findVoterSessionByHandleHash(handleHash: string, now = new Date()) {
    const session = this.sessions.get(handleHash);
    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }
    return session;
  }

  async updateVoterSessionAuthentication(command: VoterSessionAuthenticationCommand) {
    this.sessionAuthUpdates.push(command);
    const existing = this.sessions.get(command.handleHash);
    if (existing) {
      this.sessions.set(command.handleHash, {
        ...existing,
        authenticated: command.authenticated
      });
    }
  }

  async revokeVoterSession(handleHash: string) {
    this.revokedSessionHashes.push(handleHash);
    const existing = this.sessions.get(handleHash);
    if (existing) {
      this.sessions.set(handleHash, { ...existing, revokedAt: new Date() });
    }
  }

  async touchVoterSession(handleHash: string) {
    this.touchedSessionHashes.push(handleHash);
  }
}

function createRepository(inviteToken = "plain-invite-token") {
  const repository = new InMemoryVoterAuthRepository();
  const inviteTokenHash = hashInviteToken(inviteToken, hmacKey);
  repository.invitations.set(inviteTokenHash, {
    id: "invitation-1",
    electionId: "election-1",
    eligibleVoterId: "eligible-voter-1",
    votingCredentialId: "credential-1",
    inviteTokenHash,
    status: "sent",
    expiresAt: new Date("2026-01-01T01:00:00.000Z"),
    authenticationMethod: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
  });
  repository.credentials.set("credential-1", {
    id: "credential-1",
    electionId: "election-1",
    eligibleVoterId: "eligible-voter-1",
    credentialStatus: "active",
    authStatus: "not_started",
    identifierFailedAttempts: 0,
    externalIdentifierHmac: hashVoterIdentifier("member-001", hmacKey),
    hasVoted: false
  });
  return repository;
}

describe("invitation token exchange", () => {
  it("verifies invite tokens by HMAC hash and records no plaintext token", async () => {
    const inviteToken = "plain-invite-token";
    const repository = createRepository(inviteToken);

    const result = await verifyInvitationToken({
      inviteToken,
      hmacKey,
      repository,
      now
    });

    expect(result.authenticationMethod).toBe(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER);
    expect(result.requiresIdentifier).toBe(true);
    expect(result.requiresOneTimeCode).toBe(false);
    expect(repository.events[0]).toMatchObject({
      eventType: CredentialEventType.INVITE_TOKEN_VERIFIED,
      success: true
    });
    expect(JSON.stringify(repository.events)).not.toContain(inviteToken);
    expect(JSON.stringify([...repository.sessions.values()])).not.toContain(inviteToken);
  });

  it("creates voter sessions separated from invite token and Ballot/Vote identifiers", async () => {
    const inviteToken = "another-plain-invite-token";
    const repository = createRepository(inviteToken);

    const result = await verifyInvitationToken({
      inviteToken,
      hmacKey,
      repository,
      now
    });

    expect(result.opaqueHandle).not.toBe(inviteToken);
    expect(result.voterSession.opaqueHandleHash).not.toBe(result.opaqueHandle);
    expect(result.voterSession).toMatchObject({
      electionId: "election-1",
      eligibleVoterId: "eligible-voter-1",
      votingCredentialId: "credential-1"
    });
    expect(() => assertVoterSessionContainsNoBallotIdentifiers(result.voterSession)).not.toThrow();
    expect(JSON.stringify(result.voterSession)).not.toMatch(/ballotId|voteId|anonymousBallotGroupId/);
  });
});

describe("identifier verification", () => {
  it("keeps MVP default as invite link with identifier and code optional", () => {
    expect(getDefaultAuthenticationMethod()).toBe(DEFAULT_AUTHENTICATION_METHOD);
    expect(DEFAULT_AUTHENTICATION_METHOD).toBe(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER);
    expect(requiresIdentifier(DEFAULT_AUTHENTICATION_METHOD)).toBe(true);
    expect(requiresOneTimeCode(DEFAULT_AUTHENTICATION_METHOD)).toBe(false);
  });

  it("authenticates by identifier HMAC and creates update/event commands", async () => {
    const repository = createRepository();
    const result = await verifyVoterIdentifier({
      voterSession: {
        votingCredentialId: "credential-1",
        authenticationMethod: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
      },
      identifier: " member-001 ",
      hmacKey,
      repository,
      now
    });

    expect(result.authenticated).toBe(true);
    expect(repository.updates[0]).toMatchObject({
      votingCredentialId: "credential-1",
      authStatus: "authenticated",
      identifierFailedAttempts: 0
    });
    expect(repository.events[0]).toMatchObject({
      eventType: CredentialEventType.IDENTIFIER_CHECK_SUCCESS,
      success: true
    });
  });

  it("does not expose voter existence on identifier failure", async () => {
    const repository = createRepository();

    await expect(
      verifyVoterIdentifier({
        voterSession: {
          votingCredentialId: "credential-1",
          authenticationMethod: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
        },
        identifier: "wrong-id",
        hmacKey,
        repository,
        now
      })
    ).rejects.toThrow("인증 정보를 확인할 수 없습니다.");

    const normalized = normalizeApiError(
      await verifyVoterIdentifier({
        voterSession: {
          votingCredentialId: "missing-credential",
          authenticationMethod: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
        },
        identifier: "whatever",
        hmacKey,
        repository,
        now
      }).catch((error: unknown) => error)
    );

    expect(normalized.userMessage).toBe("인증 정보를 확인할 수 없습니다.");
    expect(JSON.stringify(normalized)).toContain("credential missing");
    expect(JSON.stringify({ code: normalized.code, message: normalized.userMessage })).not.toContain(
      "credential missing"
    );
  });

  it("locks credentials after repeated identifier failures", async () => {
    const repository = createRepository();
    repository.credentials.set("credential-1", {
      ...repository.credentials.get("credential-1")!,
      identifierFailedAttempts: 4
    });

    await expect(
      verifyVoterIdentifier({
        voterSession: {
          votingCredentialId: "credential-1",
          authenticationMethod: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER
        },
        identifier: "wrong-id",
        hmacKey,
        repository,
        now
      })
    ).rejects.toThrow();

    expect(repository.updates[0]).toMatchObject({
      credentialStatus: "locked",
      identifierFailedAttempts: 5
    });
    expect(repository.events[0]).toMatchObject({
      failureReasonCode: "credential_locked"
    });
    expect(repository.events[1]).toMatchObject({
      eventType: CredentialEventType.LOCKED,
      failureReasonCode: "credential_locked"
    });
  });
});

describe("one-time code option stubs", () => {
  it("rejects code requests for non-code methods", async () => {
    expect(canRequestOneTimeCode(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER)).toBe(false);
    await expect(requestOneTimeCode(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER)).rejects.toThrow(
      /권한/
    );
  });

  it("keeps code providers disabled in MVP", async () => {
    expect(canRequestOneTimeCode(AuthenticationMethod.EMAIL_CODE)).toBe(true);
    await expect(requestOneTimeCode(AuthenticationMethod.EMAIL_CODE)).rejects.toThrow(/비활성|권한/);
  });
});

describe("CredentialEvent and route skeleton guardrails", () => {
  it("keeps CredentialEvent free from Ballot/AnonymousBallotGroup identifiers", async () => {
    const repository = createRepository();
    await verifyInvitationToken({
      inviteToken: "plain-invite-token",
      hmacKey,
      repository,
      now
    });

    const serializedEvents = JSON.stringify(repository.events);
    expect(serializedEvents).not.toMatch(/ballotId|anonymousBallotGroupId|submissionEventId/);
  });

  it("does not define invite token path routes", () => {
    const invitationRoute = readFileSync(
      "src/app/api/v1/voter/invitations/verify/route.ts",
      "utf8"
    );
    expect(invitationRoute).not.toMatch(/\{invite_token\}|\[invite_token\]|\[inviteToken\]/);
  });
});

describe("voter auth route handlers", () => {
  it("exchanges invite token from request body without echoing token or opaque handle", async () => {
    const inviteToken = "route-invite-token";
    const repository = createRepository(inviteToken);
    const request = new NextRequest("https://example.test/api/v1/voter/invitations/verify", {
      method: "POST",
      body: JSON.stringify({ invite_token: inviteToken }),
      headers: { "content-type": "application/json" }
    });

    const response = await handleInvitationVerifyRoute(request, { repository, hmacKey, now });
    const payload = await response.json();
    const serializedPayload = JSON.stringify(payload);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(serializedPayload).not.toContain(inviteToken);
    expect(serializedPayload).not.toContain("opaqueHandle");
    expect(serializedPayload).not.toContain("opaque_handle");
    expect(setCookie).toContain(`${VOTER_SESSION_COOKIE_POLICY.name}=`);
    expect(setCookie).not.toContain(inviteToken);
    expect(repository.sessions.size).toBe(1);
  });

  it("verifies identifier through voter session cookie and does not expose voter existence", async () => {
    const inviteToken = "identifier-route-token";
    const repository = createRepository(inviteToken);
    const invitationRequest = new NextRequest("https://example.test/api/v1/voter/invitations/verify", {
      method: "POST",
      body: JSON.stringify({ invite_token: inviteToken }),
      headers: { "content-type": "application/json" }
    });
    const invitationResponse = await handleInvitationVerifyRoute(invitationRequest, {
      repository,
      hmacKey,
      now
    });
    const cookie = invitationResponse.headers.get("set-cookie")!.split(";")[0];

    const identifierRequest = new NextRequest("https://example.test/api/v1/voter/identifier/verify", {
      method: "POST",
      body: JSON.stringify({ identifier: "member-001" }),
      headers: {
        "content-type": "application/json",
        cookie
      }
    });
    const response = await handleIdentifierVerifyRoute(identifierRequest, {
      repository,
      hmacKey,
      now
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      authenticated: true,
      next_step: "authenticated"
    });
    expect(repository.sessionAuthUpdates[0]).toMatchObject({
      authenticated: true,
      step: "authenticated"
    });
    expect(repository.touchedSessionHashes).toHaveLength(1);

    const failedRequest = new NextRequest("https://example.test/api/v1/voter/identifier/verify", {
      method: "POST",
      body: JSON.stringify({ identifier: "wrong-member" }),
      headers: {
        "content-type": "application/json",
        cookie
      }
    });
    const failedResponse = await handleIdentifierVerifyRoute(failedRequest, {
      repository,
      hmacKey,
      now
    });
    const failedPayload = await failedResponse.json();

    expect(failedResponse.status).toBe(401);
    expect(failedPayload.error.message).toBe("인증 정보를 확인할 수 없습니다.");
    expect(JSON.stringify(failedPayload)).not.toContain("wrong-member");
    expect(JSON.stringify(failedPayload)).not.toContain("credential");
  });

  it("does not accept invite tokens from URL path", () => {
    const invitationRoute = readFileSync(
      "src/app/api/v1/voter/invitations/verify/route.ts",
      "utf8"
    );
    expect(invitationRoute).not.toMatch(/params|inviteToken|invite_token.*params/);
    expect(invitationRoute).not.toMatch(/\[invite_token\]|\[inviteToken\]/);
  });
});

describe("Prisma voter auth repository query boundaries", () => {
  it("uses invite token hash and opaque handle hash only", async () => {
    const calls: unknown[] = [];
    const prisma = {
      invitation: {
        findUnique: async (args: unknown) => {
          calls.push({ model: "invitation", args });
          return {
            id: "invitation-1",
            electionId: "election-1",
            eligibleVoterId: "eligible-voter-1",
            inviteTokenHash: "hashed-invite-token",
            status: "sent",
            expiresAt: new Date("2026-01-01T01:00:00.000Z")
          };
        }
      },
      authenticationPolicy: {
        findUnique: async () => ({
          electionId: "election-1",
          method: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER,
          isEnabled: true,
          isPaidMethod: false,
          provider: null
        })
      },
      votingCredential: {
        findUnique: async () => ({ id: "credential-1" })
      },
      voterSession: {
        create: async (args: unknown) => {
          calls.push({ model: "voterSession.create", args });
          return args;
        },
        findUnique: async (args: unknown) => {
          calls.push({ model: "voterSession.findUnique", args });
          return {
            id: "session-id",
            opaqueHandleHash: "hashed-handle",
            electionId: "election-1",
            eligibleVoterId: "eligible-voter-1",
            votingCredentialId: "credential-1",
            authenticationMethod: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER,
            authenticated: false,
            issuedAt: now,
            expiresAt: new Date("2026-01-01T00:15:00.000Z"),
            revokedAt: null,
            lastUsedAt: null
          };
        }
      }
    };
    const repository = new PrismaVoterAuthRepository(prisma as never);

    await repository.findInvitationByTokenHash("hashed-invite-token");
    await repository.createVoterSessionRecord({
      sessionId: "local-session-id",
      opaqueHandleHash: "hashed-handle",
      electionId: "election-1",
      eligibleVoterId: "eligible-voter-1",
      votingCredentialId: "credential-1",
      authenticationMethod: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER,
      authenticated: false,
      issuedAt: now,
      expiresAt: new Date("2026-01-01T00:15:00.000Z")
    });
    await repository.findVoterSessionByHandleHash("hashed-handle", now);

    const serializedCalls = JSON.stringify(calls);
    expect(serializedCalls).toContain("hashed-invite-token");
    expect(serializedCalls).toContain("hashed-handle");
    expect(serializedCalls).not.toContain("plain-invite-token");
    expect(serializedCalls).not.toContain("plain-opaque-handle");
    expect(serializedCalls).not.toMatch(/ballotId|voteId|anonymousBallotGroupId|submissionEventId/);
  });

  it("stores CredentialEvent and VoterSession without submission-area identifiers", async () => {
    const calls: unknown[] = [];
    const prisma = {
      credentialEvent: {
        create: async (args: unknown) => {
          calls.push(args);
          return args;
        }
      },
      securityEvent: {
        create: async (args: unknown) => {
          calls.push(args);
          return args;
        }
      }
    };
    const repository = new PrismaVoterAuthRepository(prisma as never);

    await repository.recordCredentialEvent({
      electionId: "election-1",
      votingCredentialId: "credential-1",
      eventType: CredentialEventType.IDENTIFIER_CHECK_SUCCESS,
      method: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER,
      success: true,
      occurredAt: now,
      metadata: {
        invite_token: "plain-token",
        sessionToken: "plain-session",
        result: "ok"
      }
    });

    const serializedCalls = JSON.stringify(calls);
    expect(serializedCalls).not.toMatch(/ballotId|voteId|anonymousBallotGroupId|submissionEventId/);
    expect(serializedCalls).not.toContain("plain-token");
    expect(serializedCalls).not.toContain("plain-session");
  });

  it("hashes opaque handles before session lookup in route-compatible flow", () => {
    const plainHandle = "plain-opaque-handle";
    const hashed = hashOpaqueHandle(plainHandle, hmacKey);

    expect(hashed).not.toBe(plainHandle);
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
  });
});
