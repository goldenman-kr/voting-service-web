import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_PARAMS = Object.freeze({
  n: 16_384,
  r: 8,
  p: 1,
  keyLength: 64
});

function scryptAsync(
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export type PasswordHashResult = Readonly<{
  passwordHash: string;
}>;

export async function hashAdminPassword(password: string): Promise<PasswordHashResult> {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptAsync(password, salt, SCRYPT_PARAMS.keyLength, {
    N: SCRYPT_PARAMS.n,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p
  });

  return Object.freeze({
    passwordHash: [
      "scrypt",
      "v1",
      `N=${SCRYPT_PARAMS.n}`,
      `r=${SCRYPT_PARAMS.r}`,
      `p=${SCRYPT_PARAMS.p}`,
      salt,
      derived.toString("base64url")
    ].join("$")
  });
}

export async function verifyAdminPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  const [algorithm, version, nValue, rValue, pValue, salt, expectedHash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || version !== "v1" || !salt || !expectedHash) {
    return false;
  }

  const n = Number(nValue?.replace("N=", ""));
  const r = Number(rValue?.replace("r=", ""));
  const p = Number(pValue?.replace("p=", ""));
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const expected = Buffer.from(expectedHash, "base64url");
  const actual = await scryptAsync(password, salt, expected.length, { N: n, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
