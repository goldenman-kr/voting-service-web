import { describe, expect, it } from "vitest";

import { Role, SensitiveField } from "../../src/guardrails/index.js";
import { createMockAdminSession } from "../../src/server/auth/admin-session";
import { InMemoryAuditRecorder } from "../../src/server/audit/audit-event";
import { createAdminActionHandler, withAdminAuth } from "../../src/server/http/handler";
import { serializeForRole } from "../../src/server/http/serialize";

describe("handler wrappers", () => {
  it("blocks unauthenticated admin requests", async () => {
    const handler = withAdminAuth(async () => ({ ok: true }));
    const response = await handler({}, {});

    expect(response).toEqual({
      ok: false,
      error: {
        code: "unauthorized",
        message: "인증 정보를 확인할 수 없습니다."
      }
    });
  });

  it("blocks requests without required permission", async () => {
    const handler = createAdminActionHandler({
      permission: "result.publish",
      targetType: "ResultVersion",
      handler: async () => ({ published: true })
    });
    const response = await handler(
      { reason: "publish" },
      { session: createMockAdminSession({ roles: [Role.ELECTION_MANAGER] }) }
    );

    expect(response).toMatchObject({
      ok: false,
      error: { code: "forbidden" }
    });
  });

  it("records audit events after authorized admin actions", async () => {
    const recorder = new InMemoryAuditRecorder();
    const session = createMockAdminSession({
      roles: [Role.ELECTION_MANAGER],
      permissions: ["election.create"],
      stepUp: undefined
    });
    const handler = createAdminActionHandler({
      permission: "election.create",
      targetType: "Election",
      auditEventType: "election.created",
      getTargetId: () => "election-1",
      handler: async (_input: { title: string; inviteToken: string; reason?: string }) => ({
        id: "election-1"
      })
    });

    const response = await handler(
      { title: "Election", inviteToken: "raw-token" },
      { session, auditRecorder: recorder }
    );

    expect(response).toMatchObject({ ok: true, data: { id: "election-1" } });
    expect(recorder.events).toHaveLength(1);
    expect(recorder.events[0]).toMatchObject({
      eventType: "election.created",
      targetType: "Election",
      targetId: "election-1"
    });
    expect(JSON.stringify(recorder.events[0])).not.toContain("raw-token");
  });
});

describe("field exposure serializer", () => {
  it("removes anonymous voting forbidden fields", () => {
    const serialized = serializeForRole(
      Role.ELECTION_MANAGER,
      {
        title: "Election",
        ballotId: "ballot-1",
        voteId: "vote-1",
        anonymousBallotGroupId: "group-1",
        ballotGroupTokenHash: "token-hash",
        [SensitiveField.IP]: "203.0.113.55",
        [SensitiveField.PARTICIPATION_STATUS]: "aggregate"
      },
      { anonymousVoting: true }
    );

    expect(serialized).toEqual({
      title: "Election",
      [SensitiveField.PARTICIPATION_STATUS]: "aggregate"
    });
  });
});
