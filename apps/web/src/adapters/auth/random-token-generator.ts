import 'server-only';
import { randomBytes } from 'node:crypto';
import type { TokenGenerator } from '@nestwise/domain/auth';

/** 256 random bits, base64url (43 characters). */
export class RandomTokenGenerator implements TokenGenerator {
  next(): string {
    return randomBytes(32).toString('base64url');
  }
}
