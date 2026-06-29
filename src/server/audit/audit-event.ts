import { AuditEventType } from "../../guardrails/index.js";
import { requiresReason } from "../../domain/audit/audit-policy";
import type { ElectionAction } from "../../domain/elections/actions";
import type { AdminSession } from "../auth/admin-session";
import { ApiError } from "../http/errors";
import { redactSensitiveValues } from "../privacy/redaction";

export type AuditEventInput = Readonly<{
  eventType: string;
  actorUserId?: string;
  tenantId: string;
  organizationId?: string;
  targetType: string;
  targetId?: string;
  riskLevel?: string;
  reason?: string;
  beforeSummary?: Record<string, unknown>;
  afterSummary?: Record<string, unknown>;
  occurredAt?: Date;
}>;

export type AuditRecorder = {
  record(event: AuditEventInput): Promise<void> | void;
};

export class InMemoryAuditRecorder implements AuditRecorder {
  readonly events: AuditEventInput[] = [];

  record(event: AuditEventInput): void {
    this.events.push(event);
  }
}

export function createAuditEventPayload({
  session,
  eventType,
  targetType,
  targetId,
  riskLevel,
  reason,
  beforeSummary,
  afterSummary,
  occurredAt = new Date()
}: {
  session: AdminSession;
  eventType: string;
  targetType: string;
  targetId?: string;
  riskLevel?: string;
  reason?: string;
  beforeSummary?: Record<string, unknown>;
  afterSummary?: Record<string, unknown>;
  occurredAt?: Date;
}): AuditEventInput {
  return Object.freeze({
    eventType,
    actorUserId: session.userId,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    targetType,
    targetId,
    riskLevel,
    reason,
    beforeSummary: beforeSummary ? redactSensitiveValues(beforeSummary) : undefined,
    afterSummary: afterSummary ? redactSensitiveValues(afterSummary) : undefined,
    occurredAt
  });
}

export function assertActionReasonProvided(action: ElectionAction, reason?: string): void {
  if (requiresReason(action) && !reason?.trim()) {
    throw new ApiError({
      status: 400,
      code: "validation_error",
      userMessage: "이 작업에는 사유 입력이 필요합니다.",
      internalReason: `reason required for ${action}`
    });
  }
}

export async function recordAuditEvent(
  recorder: AuditRecorder,
  input: AuditEventInput
): Promise<void> {
  await recorder.record(Object.freeze(redactSensitiveValues(input)));
}

export const AUDIT_EVENT_TYPES = AuditEventType;
