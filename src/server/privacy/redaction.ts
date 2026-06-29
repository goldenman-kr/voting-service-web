const REDACTED = "[REDACTED]";

const sensitiveKeyPattern =
  /(token|secret|password|credential|authenticationCode|authCode|codePlaintext|session|mfa|privateKey|encryptionKey|hmacKey)/i;

const sensitiveExactKeys = new Set([
  "invite_token",
  "inviteToken",
  "invite_token_plaintext",
  "inviteTokenPlaintext",
  "session_token",
  "sessionToken",
  "step_up_token",
  "stepUpToken",
  "authentication_code",
  "authenticationCode",
  "rawCode",
  "codePlaintext",
  "password",
  "passwordHash"
]);

export type Redacted<T> = T extends Array<infer U>
  ? Redacted<U>[]
  : T extends Record<string, unknown>
    ? { [K in keyof T]: Redacted<T[K]> }
    : T;

function shouldRedactKey(key: string): boolean {
  return sensitiveExactKeys.has(key) || sensitiveKeyPattern.test(key);
}

export function redactSensitiveValues<T>(value: T): Redacted<T> {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveValues(entry)) as Redacted<T>;
  }

  if (!value || typeof value !== "object") {
    return value as Redacted<T>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      shouldRedactKey(key) ? REDACTED : redactSensitiveValues(entry)
    ])
  ) as Redacted<T>;
}

export function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsSensitiveKey(entry));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.entries(value).some(
    ([key, entry]) => shouldRedactKey(key) || containsSensitiveKey(entry)
  );
}
