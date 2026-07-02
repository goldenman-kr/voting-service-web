import { describe, expect, it } from "vitest";

import { ElectionAction } from "../../src/domain/elections/actions";
import { createMockAdminSession } from "../../src/server/auth/admin-session";
import {
  InMemoryAuditRecorder,
  assertActionReasonProvided,
  createAuditEventPayload,
  recordAuditEvent
} from "../../src/server/audit/audit-event";
import { createSecurityEventPayload } from "../../src/server/audit/security-event";
import { ApiError, createAuthenticationError } from "../../src/server/http/errors";
import { apiError } from "../../src/server/http/response";

describe("AuditEvent boundary", () => {
  it("requires reason for risky actions", () => {
    expect(() => assertActionReasonProvided(ElectionAction.EDIT_ELECTION_INFO)).toThrow(
      /사유 입력/
    );
    expect(() =>
      assertActionReasonProvided(ElectionAction.EDIT_ELECTION_INFO, "approved release")
    ).not.toThrow();
  });

  it("redacts sensitive values in audit payloads and recorder", async () => {
    const session = createMockAdminSession();
    const recorder = new InMemoryAuditRecorder();
    const payload = createAuditEventPayload({
      session,
      eventType: "election.updated",
      targetType: "Election",
      targetId: "election-1",
      beforeSummary: {
        title: "Old",
        inviteToken: "plain-token",
        nested: { sessionToken: "plain-session" }
      },
      afterSummary: {
        title: "New",
        authenticationCode: "123456"
      }
    });

    await recordAuditEvent(recorder, payload);

    expect(recorder.events[0].beforeSummary).toMatchObject({
      title: "Old",
      inviteToken: "[REDACTED]",
      nested: { sessionToken: "[REDACTED]" }
    });
    expect(recorder.events[0].afterSummary).toMatchObject({
      title: "New",
      authenticationCode: "[REDACTED]"
    });
  });
});

describe("SecurityEvent boundary", () => {
  it("stores masked IP and user agent summary, not raw values", () => {
    const payload = createSecurityEventPayload({
      actorType: "admin",
      actorId: "user-1",
      eventType: "permission_denied",
      riskLevel: "high",
      ipAddress: "203.0.113.55",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      metadata: { sessionToken: "raw-session" },
      occurredAt: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(payload.ipMasked).toBe("203.0.113.0/24");
    expect(payload.ipHash).not.toBe("203.0.113.55");
    expect(payload.userAgentSummary).toContain("Safari");
    expect(payload.userAgentSummary).not.toContain("Mozilla/5.0");
    expect(payload.metadata).toMatchObject({ sessionToken: "[REDACTED]" });
  });
});

describe("API error responses", () => {
  it("separates user message from internal reason", () => {
    const response = apiError(createAuthenticationError("eligible voter not found"));

    expect(response).toEqual({
      ok: false,
      error: {
        code: "unauthorized",
        message: "인증 정보를 확인할 수 없습니다."
      }
    });
    expect(JSON.stringify(response)).not.toContain("eligible voter not found");
  });

  it("does not expose stack trace or sensitive details", () => {
    const response = apiError(
      new ApiError({
        status: 400,
        code: "validation_error",
        userMessage: "입력값을 확인해 주세요.",
        internalReason: "token parse failed",
        details: { inviteToken: "plain-token" }
      })
    );

    expect(JSON.stringify(response)).not.toContain("plain-token");
    expect(JSON.stringify(response)).not.toContain("stack");
  });
});
