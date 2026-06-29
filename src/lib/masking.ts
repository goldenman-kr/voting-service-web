import { createHash } from "node:crypto";

export function maskIpAddress(ipAddress: string | null | undefined): string | undefined {
  if (!ipAddress) {
    return undefined;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ipAddress)) {
    const [a, b, c] = ipAddress.split(".");
    return `${a}.${b}.${c}.0/24`;
  }

  if (ipAddress.includes(":")) {
    return `${ipAddress.split(":").slice(0, 3).join(":")}::/48`;
  }

  return "masked";
}

export function hashIpAddress(ipAddress: string | null | undefined): string | undefined {
  if (!ipAddress) {
    return undefined;
  }
  return createHash("sha256").update(ipAddress).digest("hex");
}

export function summarizeUserAgent(userAgent: string | null | undefined): string | undefined {
  if (!userAgent) {
    return undefined;
  }

  const browser =
    userAgent.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d.]+/)?.[0] ?? "UnknownBrowser";
  const platform =
    userAgent.match(/\(([^)]+)\)/)?.[1]?.split(";").slice(0, 2).join(";").trim() ??
    "UnknownPlatform";

  return `${browser} on ${platform}`.slice(0, 160);
}
