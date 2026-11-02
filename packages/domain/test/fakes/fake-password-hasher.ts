import type { PasswordHasher } from '../../src/auth';

/** A readable stand-in for scrypt: "hashed:<password>". Real hashing is tested in the web adapter. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, hash: string | undefined): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}
