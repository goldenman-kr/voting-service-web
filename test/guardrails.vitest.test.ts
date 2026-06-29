import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTHENTICATION_METHOD,
  ElectionState,
  PERMISSIONS,
  ROLE_PERMISSIONS
} from "../src/guardrails/index.js";

describe("guardrail module integration", () => {
  it("keeps guardrails importable from TypeScript tests", () => {
    expect(DEFAULT_AUTHENTICATION_METHOD).toBe("invite_link_with_identifier");
    expect(ElectionState.DRAFT).toBe("draft");
    expect(PERMISSIONS.length).toBeGreaterThan(0);
    expect(Object.keys(ROLE_PERMISSIONS).length).toBeGreaterThan(0);
  });
});
