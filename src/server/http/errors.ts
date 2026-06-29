import { redactSensitiveValues } from "../privacy/redaction";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_error"
  | "step_up_required"
  | "internal_error";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly userMessage: string;
  readonly internalReason?: string;
  readonly details?: Record<string, unknown>;

  constructor({
    status,
    code,
    userMessage,
    internalReason,
    details
  }: {
    status: number;
    code: ApiErrorCode;
    userMessage: string;
    internalReason?: string;
    details?: Record<string, unknown>;
  }) {
    super(userMessage);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.userMessage = userMessage;
    this.internalReason = internalReason;
    this.details = details;
  }
}

export function createAuthenticationError(internalReason?: string): ApiError {
  return new ApiError({
    status: 401,
    code: "unauthorized",
    userMessage: "인증 정보를 확인할 수 없습니다.",
    internalReason
  });
}

export function createForbiddenError(internalReason?: string): ApiError {
  return new ApiError({
    status: 403,
    code: "forbidden",
    userMessage: "요청한 작업을 수행할 권한이 없습니다.",
    internalReason
  });
}

export function createStepUpRequiredError(internalReason?: string): ApiError {
  return new ApiError({
    status: 403,
    code: "step_up_required",
    userMessage: "이 작업은 추가 인증이 필요합니다.",
    internalReason
  });
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError({
    status: 500,
    code: "internal_error",
    userMessage: "요청을 처리하지 못했습니다.",
    internalReason: error instanceof Error ? error.message : "unknown error",
    details: redactSensitiveValues({ error })
  });
}
