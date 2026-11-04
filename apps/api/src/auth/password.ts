import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LENGTH, {
    N: COST, r: BLOCK_SIZE, p: PARALLELIZATION,
  })) as Buffer;
  return ["scrypt", COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltText, hashText] = encoded.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltText || !hashText) return false;
  const cost = Number(n);
  const blockSize = Number(r);
  const parallelization = Number(p);
  if (!Number.isSafeInteger(cost) || cost < 16_384 || cost > 262_144 ||
      !Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 16 ||
      !Number.isSafeInteger(parallelization) || parallelization < 1 || parallelization > 4) return false;
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(hashText, "base64url");
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
  const actual = (await scrypt(password, salt, KEY_LENGTH, {
    N: cost, r: blockSize, p: parallelization,
  })) as Buffer;
  return timingSafeEqual(actual, expected);
}
