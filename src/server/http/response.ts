import { normalizeApiError } from "./errors";

export type ApiSuccessResponse<T> = Readonly<{
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}>;

export type ApiErrorResponse = Readonly<{
  ok: false;
  error: {
    code: string;
    message: string;
  };
}>;

export function apiSuccess<T>(
  data: T,
  meta?: Record<string, unknown>
): ApiSuccessResponse<T> {
  return Object.freeze({
    ok: true,
    data,
    ...(meta ? { meta } : {})
  });
}

export function apiError(error: unknown): ApiErrorResponse {
  const normalized = normalizeApiError(error);
  return Object.freeze({
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.userMessage
    }
  });
}
