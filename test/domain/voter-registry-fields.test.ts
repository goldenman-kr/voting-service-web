import { describe, expect, it } from "vitest";

import {
  canonicalVoterIdentifier,
  formatVoterRegistryRows,
  parseVoterRegistryTextRows,
  validateVoterRegistryFields
} from "../../src/lib/voter-registry-fields";

describe("voter registry canonical fields", () => {
  it("validates required voter registry fields and preserves leading zero fields", () => {
    const result = validateVoterRegistryFields({
      householdNumber: "0007",
      name: " 홍 길동 ",
      identifierLast4: "0001",
      birthDate6: "090101"
    });

    expect(result.ok).toBe(true);
    expect(result.fields).toEqual({
      householdNumber: "7",
      name: "홍길동",
      identifierLast4: "0001",
      birthDate6: "090101"
    });
    expect(result.fields && canonicalVoterIdentifier(result.fields)).toBe("7|홍길동|0001|090101");
  });

  it("rejects invalid household, identifier, birth date, and missing name", () => {
    const result = validateVoterRegistryFields({
      householdNumber: "123",
      name: "",
      identifierLast4: "12",
      birthDate6: "9001011"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(4);
  });

  it("can omit birth date only when the registry verification option disables it", () => {
    const result = validateVoterRegistryFields({
      householdNumber: "7",
      name: "홍길동",
      identifierLast4: "0001",
      birthDate6: ""
    }, { requireBirthDate: false });

    expect(result.ok).toBe(true);
    expect(result.fields && canonicalVoterIdentifier(result.fields, { includeBirthDate: false }))
      .toBe("7|홍길동|0001");
  });

  it("parses header-based CSV text and formats canonical registry rows", () => {
    const rows = parseVoterRegistryTextRows("이름,식별번호,호수번호,생년월일\n김영희,0423,0012,880715");

    expect(rows).toEqual([
      {
        rowNumber: 2,
        householdNumber: "0012",
        name: "김영희",
        identifierLast4: "0423",
        birthDate6: "880715"
      }
    ]);
    expect(formatVoterRegistryRows(rows)).toBe("호수번호,이름,식별번호,생년월일\n12,김영희,0423,880715");
  });
});
