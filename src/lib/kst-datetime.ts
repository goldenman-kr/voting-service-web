const KST_OFFSET_MINUTES = 9 * 60;
const KST_OFFSET_MS = KST_OFFSET_MINUTES * 60 * 1000;

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseKstDateTimeInput(value: string): Date {
  const trimmed = value.trim();
  const match = localDateTimePattern.exec(trimmed);
  if (!match) {
    return new Date(trimmed);
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");
  const localUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const localUtc = new Date(localUtcMs);
  if (
    localUtc.getUTCFullYear() !== year ||
    localUtc.getUTCMonth() !== month - 1 ||
    localUtc.getUTCDate() !== day ||
    localUtc.getUTCHours() !== hour ||
    localUtc.getUTCMinutes() !== minute ||
    localUtc.getUTCSeconds() !== second
  ) {
    return new Date(Number.NaN);
  }

  return new Date(localUtcMs - KST_OFFSET_MS);
}

export function coerceDateInputAsKst(value: unknown): unknown {
  return typeof value === "string" ? parseKstDateTimeInput(value) : value;
}

export function formatDateTimeLocalKst(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return [
    kst.getUTCFullYear(),
    pad(kst.getUTCMonth() + 1),
    pad(kst.getUTCDate())
  ].join("-") + `T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}
