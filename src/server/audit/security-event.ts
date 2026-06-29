import { SecurityEventType } from "../../guardrails/index.js";
import { hashIpAddress, maskIpAddress, summarizeUserAgent } from "../../lib/masking";
import { redactSensitiveValues } from "../privacy/redaction";

export type SecurityEventName =
  | (typeof SecurityEventType)[keyof typeof SecurityEventType]
  | "permission_denied";

export type SecurityEventInput = Readonly<{
  tenantId?: string;
  actorType: "admin" | "voter" | "public" | "unknown";
  actorId?: string;
  eventType: SecurityEventName;
  riskLevel: "low" | "medium" | "high" | "critical";
  ipMasked?: string;
  ipHash?: string;
  userAgentSummary?: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}>;

export function createSecurityEventPayload({
  tenantId,
  actorType,
  actorId,
  eventType,
  riskLevel,
  ipAddress,
  userAgent,
  metadata,
  occurredAt = new Date()
}: {
  tenantId?: string;
  actorType: SecurityEventInput["actorType"];
  actorId?: string;
  eventType: SecurityEventName;
  riskLevel: SecurityEventInput["riskLevel"];
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}): SecurityEventInput {
  return Object.freeze({
    tenantId,
    actorType,
    actorId,
    eventType,
    riskLevel,
    ipMasked: maskIpAddress(ipAddress),
    ipHash: hashIpAddress(ipAddress),
    userAgentSummary: summarizeUserAgent(userAgent),
    occurredAt,
    metadata: metadata ? redactSensitiveValues(metadata) : undefined
  });
}
