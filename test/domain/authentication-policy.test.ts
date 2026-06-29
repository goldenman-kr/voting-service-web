import { describe, expect, it } from "vitest";

import { AuthenticationMethod } from "../../src/guardrails/index.js";
import {
  appliesCodeExpiryPolicy,
  appliesCodeFailureLockPolicy,
  appliesCodeResendPolicy,
  getAuthenticationMethodCapabilities,
  getDefaultAuthenticationMethod,
  isAvailableInMvp,
  isPaidAuthenticationMethod,
  requiresIdentifier,
  requiresOneTimeCode
} from "../../src/domain/auth-policy/authentication-policy";

describe("AuthenticationPolicy helpers", () => {
  it("keeps the MVP default authentication method", () => {
    expect(getDefaultAuthenticationMethod()).toBe(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER);
    expect(getAuthenticationMethodCapabilities(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER)).toMatchObject({
      enabledByDefault: true,
      requiresIdentifier: true,
      requiresOneTimeCode: false,
      paidMethod: false,
      availableInMvp: true
    });
  });

  it("keeps one-time codes optional and method-specific", () => {
    expect(requiresOneTimeCode(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER)).toBe(false);
    expect(requiresOneTimeCode(AuthenticationMethod.EMAIL_CODE)).toBe(true);
    expect(appliesCodeResendPolicy(AuthenticationMethod.EMAIL_CODE)).toBe(true);
    expect(appliesCodeExpiryPolicy(AuthenticationMethod.EMAIL_CODE)).toBe(true);
    expect(appliesCodeFailureLockPolicy(AuthenticationMethod.EMAIL_CODE)).toBe(true);
    expect(appliesCodeResendPolicy(AuthenticationMethod.INVITE_LINK_ONLY)).toBe(false);
  });

  it("keeps paid and external methods disabled for MVP by default", () => {
    for (const method of [
      AuthenticationMethod.SMS_CODE,
      AuthenticationMethod.KAKAO_MESSAGE,
      AuthenticationMethod.EXTERNAL_IDENTITY,
      AuthenticationMethod.SSO,
      AuthenticationMethod.LEGAL_STRONG_AUTH
    ]) {
      expect(isPaidAuthenticationMethod(method)).toBe(true);
      expect(isAvailableInMvp(method)).toBe(false);
      expect(getAuthenticationMethodCapabilities(method).enabledByDefault).toBe(false);
    }
  });

  it("captures identifier requirements separately from code requirements", () => {
    expect(requiresIdentifier(AuthenticationMethod.INVITE_LINK_ONLY)).toBe(false);
    expect(requiresIdentifier(AuthenticationMethod.INVITE_LINK_WITH_IDENTIFIER)).toBe(true);
    expect(requiresIdentifier(AuthenticationMethod.EMAIL_CODE)).toBe(true);
  });
});
