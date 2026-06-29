import {
  AuthenticationMethod,
  CODE_AUTHENTICATION_METHODS,
  DEFAULT_AUTHENTICATION_METHOD
} from "../../guardrails/index.js";

export type AuthenticationMethodValue =
  (typeof AuthenticationMethod)[keyof typeof AuthenticationMethod];

export type AuthenticationMethodCapabilities = Readonly<{
  method: AuthenticationMethodValue;
  enabledByDefault: boolean;
  requiresIdentifier: boolean;
  requiresOneTimeCode: boolean;
  paidMethod: boolean;
  securityLevel: "low" | "standard" | "high" | "legal";
  availableInMvp: boolean;
  supportsResendPolicy: boolean;
  supportsCodeExpiryPolicy: boolean;
  supportsCodeFailureLockPolicy: boolean;
}>;

const capabilities: Readonly<Record<AuthenticationMethodValue, AuthenticationMethodCapabilities>> =
  Object.freeze({
    [AuthenticationMethod.INVITE_LINK_ONLY]: Object.freeze({
      method: AuthenticationMethod.INVITE_LINK_ONLY,
      enabledByDefault: false,
      requiresIdentifier: false,
      requiresOneTimeCode: false,
      paidMethod: false,
      securityLevel: "low",
      availableInMvp: true,
      supportsResendPolicy: false,
      supportsCodeExpiryPolicy: false,
      supportsCodeFailureLockPolicy: false
    }),
    [AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER]: Object.freeze({
      method: AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER,
      enabledByDefault: true,
      requiresIdentifier: true,
      requiresOneTimeCode: false,
      paidMethod: false,
      securityLevel: "standard",
      availableInMvp: true,
      supportsResendPolicy: false,
      supportsCodeExpiryPolicy: false,
      supportsCodeFailureLockPolicy: false
    }),
    [AuthenticationMethod.EMAIL_CODE]: Object.freeze({
      method: AuthenticationMethod.EMAIL_CODE,
      enabledByDefault: false,
      requiresIdentifier: true,
      requiresOneTimeCode: true,
      paidMethod: false,
      securityLevel: "high",
      availableInMvp: false,
      supportsResendPolicy: true,
      supportsCodeExpiryPolicy: true,
      supportsCodeFailureLockPolicy: true
    }),
    [AuthenticationMethod.SMS_CODE]: Object.freeze({
      method: AuthenticationMethod.SMS_CODE,
      enabledByDefault: false,
      requiresIdentifier: true,
      requiresOneTimeCode: true,
      paidMethod: true,
      securityLevel: "high",
      availableInMvp: false,
      supportsResendPolicy: true,
      supportsCodeExpiryPolicy: true,
      supportsCodeFailureLockPolicy: true
    }),
    [AuthenticationMethod.KAKAO_MESSAGE]: Object.freeze({
      method: AuthenticationMethod.KAKAO_MESSAGE,
      enabledByDefault: false,
      requiresIdentifier: true,
      requiresOneTimeCode: true,
      paidMethod: true,
      securityLevel: "high",
      availableInMvp: false,
      supportsResendPolicy: true,
      supportsCodeExpiryPolicy: true,
      supportsCodeFailureLockPolicy: true
    }),
    [AuthenticationMethod.EXTERNAL_IDENTITY]: Object.freeze({
      method: AuthenticationMethod.EXTERNAL_IDENTITY,
      enabledByDefault: false,
      requiresIdentifier: false,
      requiresOneTimeCode: false,
      paidMethod: true,
      securityLevel: "high",
      availableInMvp: false,
      supportsResendPolicy: false,
      supportsCodeExpiryPolicy: false,
      supportsCodeFailureLockPolicy: false
    }),
    [AuthenticationMethod.SSO]: Object.freeze({
      method: AuthenticationMethod.SSO,
      enabledByDefault: false,
      requiresIdentifier: false,
      requiresOneTimeCode: false,
      paidMethod: true,
      securityLevel: "high",
      availableInMvp: false,
      supportsResendPolicy: false,
      supportsCodeExpiryPolicy: false,
      supportsCodeFailureLockPolicy: false
    }),
    [AuthenticationMethod.LEGAL_STRONG_AUTH]: Object.freeze({
      method: AuthenticationMethod.LEGAL_STRONG_AUTH,
      enabledByDefault: false,
      requiresIdentifier: false,
      requiresOneTimeCode: false,
      paidMethod: true,
      securityLevel: "legal",
      availableInMvp: false,
      supportsResendPolicy: false,
      supportsCodeExpiryPolicy: false,
      supportsCodeFailureLockPolicy: false
    })
  });

export function getDefaultAuthenticationMethod(): AuthenticationMethodValue {
  return DEFAULT_AUTHENTICATION_METHOD;
}

export function getAuthenticationMethodCapabilities(
  method: AuthenticationMethodValue
): AuthenticationMethodCapabilities {
  return capabilities[method];
}

export function requiresIdentifier(method: AuthenticationMethodValue): boolean {
  return getAuthenticationMethodCapabilities(method).requiresIdentifier;
}

export function requiresOneTimeCode(method: AuthenticationMethodValue): boolean {
  return (CODE_AUTHENTICATION_METHODS as readonly string[]).includes(method);
}

export function isPaidAuthenticationMethod(method: AuthenticationMethodValue): boolean {
  return getAuthenticationMethodCapabilities(method).paidMethod;
}

export function isAvailableInMvp(method: AuthenticationMethodValue): boolean {
  return getAuthenticationMethodCapabilities(method).availableInMvp;
}

export function appliesCodeResendPolicy(method: AuthenticationMethodValue): boolean {
  return requiresOneTimeCode(method);
}

export function appliesCodeExpiryPolicy(method: AuthenticationMethodValue): boolean {
  return requiresOneTimeCode(method);
}

export function appliesCodeFailureLockPolicy(method: AuthenticationMethodValue): boolean {
  return requiresOneTimeCode(method);
}
