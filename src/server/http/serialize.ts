import type { RoleValue, SanitizeContext } from "../privacy/field-exposure";
import { sanitizeResponseForRole } from "../privacy/field-exposure";

export function serializeForRole<T extends Record<string, unknown>>(
  role: RoleValue,
  payload: T,
  context?: SanitizeContext
): Partial<T> {
  return sanitizeResponseForRole(role, payload, context);
}
