import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { EmailAlreadyRegisteredError, type User } from '@nestwise/domain/auth';
import { describe, expect, it } from 'vitest';
import { DrizzleSessionGateway } from '@/adapters/auth/drizzle-session-gateway';
import { DrizzleUserGateway } from '@/adapters/auth/drizzle-user-gateway';
import { RandomTokenGenerator } from '@/adapters/auth/random-token-generator';
import { ScryptPasswordHasher } from '@/adapters/auth/scrypt-password-hasher';
import { useTestDb } from '../../setup';

const db = useTestDb();

const user = (overrides: Partial<User> = {}): User => ({
  id: '00000000-0000-4000-8000-0000000000a1',
  email: 'priya@example.com',
  passwordHash: 'scrypt$hash',
  createdAt: new Date('2026-11-02T10:00:00Z'),
  ...overrides,
});

describe('DrizzleUserGateway', () => {
  it('saves and finds a user by email and by id', async () => {
    const users = new DrizzleUserGateway(db());
    await users.save(user());
    expect(await users.findByEmail('priya@example.com')).toEqual(user());
    expect(await users.findById(user().id)).toEqual(user());
    expect(await users.findByEmail('nobody@example.com')).toBeUndefined();
  });

  it('turns a duplicate email into EmailAlreadyRegisteredError, even when two saves race', async () => {
    const users = new DrizzleUserGateway(db());
    const results = await Promise.allSettled([
      users.save(user({ id: '00000000-0000-4000-8000-0000000000b1' })),
      users.save(user({ id: '00000000-0000-4000-8000-0000000000b2' })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(EmailAlreadyRegisteredError);
  });
});

describe('DrizzleSessionGateway', () => {
  it('stores only a hash of the token, finds live sessions, ignores expired ones, and deletes', async () => {
    const users = new DrizzleUserGateway(db());
    const sessions = new DrizzleSessionGateway(db());
    await users.save(user());
    await sessions.create({ token: 'raw-token-123', userId: user().id, expiresAt: new Date('2027-05-01T10:00:00Z') });

    const { rows } = await db().execute<{ token_hash: string }>(sql`select token_hash from app.sessions`);
    expect(rows).toEqual([{ token_hash: createHash('sha256').update('raw-token-123').digest('hex') }]);

    expect(await sessions.findUserId('raw-token-123', new Date('2027-05-01T09:59:59Z'))).toBe(user().id);
    expect(await sessions.findUserId('raw-token-123', new Date('2027-05-01T10:00:00Z'))).toBeUndefined();
    expect(await sessions.findUserId('other-token', new Date('2026-11-02T10:00:00Z'))).toBeUndefined();

    await sessions.delete('raw-token-123');
    expect(await sessions.findUserId('raw-token-123', new Date('2026-11-02T10:00:00Z'))).toBeUndefined();
  });
});

describe('ScryptPasswordHasher', () => {
  it('hashes with a fresh salt and verifies only the right password', async () => {
    const hasher = new ScryptPasswordHasher();
    const first = await hasher.hash('correct-horse');
    const second = await hasher.hash('correct-horse');
    expect(first).toMatch(/^scrypt\$/);
    expect(first).not.toContain('correct-horse');
    expect(first).not.toBe(second);
    expect(await hasher.verify('correct-horse', first)).toBe(true);
    expect(await hasher.verify('wrong-horse', first)).toBe(false);
    expect(await hasher.verify('correct-horse', undefined)).toBe(false);
    expect(await hasher.verify('correct-horse', 'not-a-hash')).toBe(false);
  });
});

describe('RandomTokenGenerator', () => {
  it('makes long, different tokens', () => {
    const tokens = new RandomTokenGenerator();
    const a = tokens.next();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens.next()).not.toBe(a);
  });
});
