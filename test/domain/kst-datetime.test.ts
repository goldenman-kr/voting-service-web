import { describe, expect, it } from "vitest";

import { formatDateTimeLocalKst, parseKstDateTimeInput } from "../../src/lib/kst-datetime";
import { electionDraftInputSchema } from "../../src/server/elections/validation";

describe("KST datetime helpers", () => {
  it("parses timezone-less datetime-local values as KST", () => {
    expect(parseKstDateTimeInput("2026-07-02T09:30").toISOString()).toBe("2026-07-02T00:30:00.000Z");
  });

  it("keeps explicit UTC instants unchanged", () => {
    expect(parseKstDateTimeInput("2026-07-02T09:30:00.000Z").toISOString()).toBe("2026-07-02T09:30:00.000Z");
  });

  it("formats stored instants back to datetime-local KST values", () => {
    expect(formatDateTimeLocalKst(new Date("2026-07-02T00:30:00.000Z"))).toBe("2026-07-02T09:30");
  });

  it("coerces election date inputs with KST semantics", () => {
    const parsed = electionDraftInputSchema.parse({
      title: "KST vote",
      electionType: "representative_election",
      votingMode: "anonymous",
      startsAt: "2026-07-02T09:30",
      endsAt: "2026-07-02T10:30",
      timezone: "Asia/Seoul"
    });

    expect(parsed.startsAt.toISOString()).toBe("2026-07-02T00:30:00.000Z");
    expect(parsed.endsAt.toISOString()).toBe("2026-07-02T01:30:00.000Z");
  });
});
