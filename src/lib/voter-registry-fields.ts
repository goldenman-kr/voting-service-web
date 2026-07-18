export type VoterRegistryFields = Readonly<{
  householdNumber: string;
  name: string;
  identifierLast4: string;
  birthDate6: string;
}>;

export type ParsedVoterRegistryRow = Partial<VoterRegistryFields> & Readonly<{
  rowNumber: number;
}>;

export const voterRegistryCsvHeader = "호수번호,이름,식별번호,생년월일";

const fieldLabels: Record<keyof VoterRegistryFields, string> = {
  householdNumber: "호수번호",
  name: "이름",
  identifierLast4: "식별번호",
  birthDate6: "생년월일"
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeHouseholdNumber(value: unknown): string {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return raw;
  return raw.replace(/^0+(?=\d)/, "");
}

export function normalizeVoterRegistryFields(input: Partial<VoterRegistryFields>): VoterRegistryFields {
  return {
    householdNumber: normalizeHouseholdNumber(input.householdNumber),
    name: clean(input.name).replace(/\s+/g, ""),
    identifierLast4: clean(input.identifierLast4),
    birthDate6: clean(input.birthDate6)
  };
}

export function validateVoterRegistryFields(
  input: Partial<VoterRegistryFields>,
  options?: { requireBirthDate?: boolean }
): {
  ok: boolean;
  fields?: VoterRegistryFields;
  errors: string[];
} {
  const fields = normalizeVoterRegistryFields(input);
  const errors: string[] = [];

  if (!/^\d{1,2}$/.test(fields.householdNumber)) {
    errors.push(`${fieldLabels.householdNumber}는 숫자로 입력하고 앞자리 0을 제외한 값은 1~2자리여야 합니다.`);
  }
  if (!fields.name) {
    errors.push(`${fieldLabels.name}을 입력해 주세요.`);
  }
  if (!/^\d{4}$/.test(fields.identifierLast4)) {
    errors.push(`${fieldLabels.identifierLast4}는 숫자 4자리로 입력해 주세요.`);
  }
  if (options?.requireBirthDate !== false && !/^\d{6}$/.test(fields.birthDate6)) {
    errors.push(`${fieldLabels.birthDate6}은 숫자 6자리로 입력해 주세요.`);
  }

  return errors.length === 0 ? { ok: true, fields, errors } : { ok: false, errors };
}

export function canonicalVoterIdentifier(
  fields: VoterRegistryFields,
  options?: { includeBirthDate?: boolean }
): string {
  const values = [
    fields.householdNumber,
    fields.name,
    fields.identifierLast4
  ];
  if (options?.includeBirthDate !== false) {
    values.push(fields.birthDate6);
  }
  return values.join("|");
}

export function encodedVoterRegistryPayload(fields: VoterRegistryFields): string {
  return JSON.stringify({ version: 1, ...fields });
}

export function decodeVoterRegistryPayload(raw: string | undefined | null): VoterRegistryFields | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VoterRegistryFields> & { version?: unknown };
    const result = validateVoterRegistryFields(parsed);
    return result.ok && result.fields ? result.fields : null;
  } catch {
    return null;
  }
}

function splitDelimitedLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if ((char === "," || char === "\t") && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function headerKey(value: string): keyof VoterRegistryFields | null {
  const normalized = value.replace(/\s/g, "");
  if (normalized === "호수번호" || normalized === "호수") return "householdNumber";
  if (normalized === "이름" || normalized === "성명") return "name";
  if (normalized === "식별번호" || normalized === "전화번호뒷4자리" || normalized === "전화번호뒤4자리") {
    return "identifierLast4";
  }
  if (normalized === "생년월일" || normalized === "생년월일6자리") return "birthDate6";
  return null;
}

export function parseVoterRegistryTextRows(raw: string): ParsedVoterRegistryRow[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstCells = splitDelimitedLine(lines[0]);
  const header = firstCells.map(headerKey);
  const hasHeader = header.some(Boolean);
  const body = hasHeader ? lines.slice(1) : lines;

  return body.map((line, index) => {
    const cells = splitDelimitedLine(line);
    const rowNumber = (hasHeader ? index + 2 : index + 1);
    if (hasHeader) {
      const row: ParsedVoterRegistryRow = { rowNumber };
      header.forEach((key, cellIndex) => {
        if (key) {
          (row as Record<keyof VoterRegistryFields, string>)[key] = cells[cellIndex] ?? "";
        }
      });
      return row;
    }
    return {
      rowNumber,
      householdNumber: cells[0] ?? "",
      name: cells[1] ?? "",
      identifierLast4: cells[2] ?? "",
      birthDate6: cells[3] ?? ""
    };
  });
}

export function formatVoterRegistryRows(rows: readonly Partial<VoterRegistryFields>[]): string {
  return [
    voterRegistryCsvHeader,
    ...rows.map((row) => {
      const normalized = normalizeVoterRegistryFields(row);
      return [
        normalized.householdNumber,
        normalized.name,
        normalized.identifierLast4,
        normalized.birthDate6
      ].join(",");
    })
  ].join("\n");
}
