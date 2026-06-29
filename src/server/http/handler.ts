import { apiError, apiSuccess } from "./response";
import { createAuthenticationError } from "./errors";
import type { AdminSession } from "../auth/admin-session";
import { requirePermissionWithStepUp, type PermissionCode } from "../rbac/authorize";
import {
  createAuditEventPayload,
  recordAuditEvent,
  type AuditRecorder
} from "../audit/audit-event";
import { redactSensitiveValues } from "../privacy/redaction";

export type AdminHandlerContext = Readonly<{
  session?: AdminSession;
  auditRecorder?: AuditRecorder;
  now?: Date;
}>;

export type AuthenticatedAdminHandlerContext = AdminHandlerContext & Readonly<{
  session: AdminSession;
}>;

export type AdminHandler<TInput, TOutput> = (
  input: TInput,
  context: AuthenticatedAdminHandlerContext
) => Promise<TOutput> | TOutput;

export function withAdminAuth<TInput, TOutput>(
  handler: AdminHandler<TInput, TOutput>
) {
  return async (input: TInput, context: AdminHandlerContext) => {
    if (!context.session) {
      return apiError(createAuthenticationError("missing admin session"));
    }
    try {
      return apiSuccess(await handler(input, { ...context, session: context.session }));
    } catch (error) {
      return apiError(error);
    }
  };
}

export function createAdminActionHandler<TInput extends { reason?: string }, TOutput>({
  permission,
  targetType,
  getTargetId,
  auditEventType,
  handler
}: {
  permission: PermissionCode;
  targetType: string;
  getTargetId?: (input: TInput) => string | undefined;
  auditEventType?: string;
  handler: AdminHandler<TInput, TOutput>;
}) {
  return async (input: TInput, context: AdminHandlerContext) => {
    if (!context.session) {
      return apiError(createAuthenticationError("missing admin session"));
    }

    try {
      requirePermissionWithStepUp(context.session, permission, context.now);
      const result = await handler(input, { ...context, session: context.session });

      if (context.auditRecorder && auditEventType) {
        await recordAuditEvent(
          context.auditRecorder,
          createAuditEventPayload({
            session: context.session,
            eventType: auditEventType,
            targetType,
            targetId: getTargetId?.(input),
            reason: input.reason,
            afterSummary: { input: redactSensitiveValues(input) }
          })
        );
      }

      return apiSuccess(result);
    } catch (error) {
      return apiError(error);
    }
  };
}
