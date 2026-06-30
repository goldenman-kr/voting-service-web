import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "encrypted:v1:";

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptPersonalValue(value: string | undefined, encryptionKey: string): string | undefined {
  if (!value) return undefined;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptPersonalValue(value: string | undefined | null, encryptionKey: string): string | undefined {
  if (!value?.startsWith(PREFIX)) return undefined;
  const [, ivRaw, tagRaw, ciphertextRaw] = value.match(/^encrypted:v1:([^:]+):([^:]+):(.+)$/) ?? [];
  if (!ivRaw || !tagRaw || !ciphertextRaw) return undefined;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(encryptionKey), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextRaw, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return undefined;
  }
}
