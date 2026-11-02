import 'server-only';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '@nestwise/domain/auth';

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, keyLength: number, params: typeof PARAMS): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keyLength, params, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

/** Stored as `scrypt$N$r$p$salt$hash` (base64), so parameters can be raised later without breaking old hashes. */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, KEY_LENGTH, PARAMS);
    return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
  }

  async verify(password: string, hash: string | undefined): Promise<boolean> {
    const parts = hash?.split('$');
    if (!parts || parts.length !== 6 || parts[0] !== 'scrypt') {
      await derive(password, randomBytes(16), KEY_LENGTH, PARAMS); // same work, so timing does not reveal unknown emails
      return false;
    }
    const [, n, r, p, salt, expectedB64] = parts as [string, string, string, string, string, string];
    const expected = Buffer.from(expectedB64, 'base64');
    const actual = await derive(password, Buffer.from(salt, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMS.maxmem,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
