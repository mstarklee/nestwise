import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { EmailAlreadyRegisteredError, GoogleAccountConflictError, type User } from '@nestwise/domain/auth';
import { describe, expect, it } from 'vitest';
import { DrizzleOneTimeTokenGateway } from '@/adapters/auth/drizzle-one-time-token-gateway';
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
  emailVerifiedAt: null,
  googleSubject: null,
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

  it('updates the password, verification and Google link, and finds by Google id', async () => {
    const users = new DrizzleUserGateway(db());
    await users.save(user());
    const changed = user({ passwordHash: null, emailVerifiedAt: new Date('2026-11-06T10:00:00Z'), googleSubject: 'google-123' });
    await users.update(changed);
    expect(await users.findById(user().id)).toEqual(changed);
    expect(await users.findByGoogleSubject('google-123')).toEqual(changed);
    expect(await users.findByGoogleSubject('google-other')).toBeUndefined();
  });

  it('turns a Google id already used by another account into GoogleAccountConflictError', async () => {
    const users = new DrizzleUserGateway(db());
    await users.save(user({ googleSubject: 'google-123' }));
    const other = user({ id: '00000000-0000-4000-8000-0000000000a2', email: 'arun@example.com' });
    await users.save(other);
    await expect(users.update({ ...other, googleSubject: 'google-123' })).rejects.toBeInstanceOf(GoogleAccountConflictError);
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

  it('signs one account out everywhere and leaves other accounts alone', async () => {
    const users = new DrizzleUserGateway(db());
    const sessions = new DrizzleSessionGateway(db());
    const other = user({ id: '00000000-0000-4000-8000-0000000000a2', email: 'arun@example.com' });
    await users.save(user());
    await users.save(other);
    const expiresAt = new Date('2027-05-01T10:00:00Z');
    await sessions.create({ token: 'priya-1', userId: user().id, expiresAt });
    await sessions.create({ token: 'priya-2', userId: user().id, expiresAt });
    await sessions.create({ token: 'arun-1', userId: other.id, expiresAt });
    await sessions.deleteAllForUser(user().id);
    const now = new Date('2026-11-06T10:00:00Z');
    expect(await sessions.findUserId('priya-1', now)).toBeUndefined();
    expect(await sessions.findUserId('priya-2', now)).toBeUndefined();
    expect(await sessions.findUserId('arun-1', now)).toBe(other.id);
  });
});

describe('DrizzleOneTimeTokenGateway', () => {
  const now = new Date('2026-11-06T10:00:00Z');
  const link = (token: string, purpose: 'verify_email' | 'reset_password' = 'verify_email', expiresAt = new Date('2026-11-07T10:00:00Z')) => ({
    token,
    userId: user().id,
    purpose,
    createdAt: now,
    expiresAt,
  });

  it('stores only a hash, and a token works once, for its own purpose, until it expires', async () => {
    await new DrizzleUserGateway(db()).save(user());
    const links = new DrizzleOneTimeTokenGateway(db());
    await links.create(link('verify-raw'));
    await links.create(link('reset-raw', 'reset_password', new Date('2026-11-06T11:00:00Z')));

    const { rows } = await db().execute<{ token_hash: string }>(sql`select token_hash from app.auth_tokens order by purpose desc`);
    expect(rows.map((r) => r.token_hash)).toEqual([
      createHash('sha256').update('verify-raw').digest('hex'),
      createHash('sha256').update('reset-raw').digest('hex'),
    ]);

    expect(await links.consume('verify-raw', 'reset_password', now)).toBeUndefined();
    expect(await links.consume('reset-raw', 'reset_password', new Date('2026-11-06T11:00:00Z'))).toBeUndefined();
    expect(await links.consume('verify-raw', 'verify_email', now)).toBe(user().id);
    expect(await links.consume('verify-raw', 'verify_email', now)).toBeUndefined();
    expect(await links.consume('made-up', 'verify_email', now)).toBeUndefined();
  });

  it('lets only one of two simultaneous uses win', async () => {
    await new DrizzleUserGateway(db()).save(user());
    const links = new DrizzleOneTimeTokenGateway(db());
    await links.create(link('race-raw', 'reset_password', new Date('2026-11-06T11:00:00Z')));
    const results = await Promise.all([links.consume('race-raw', 'reset_password', now), links.consume('race-raw', 'reset_password', now)]);
    expect(results.filter(Boolean)).toEqual([user().id]);
  });

  it('revokes unused tokens of one purpose and reports the newest creation time', async () => {
    await new DrizzleUserGateway(db()).save(user());
    const links = new DrizzleOneTimeTokenGateway(db());
    expect(await links.latestCreatedAt(user().id, 'verify_email')).toBeUndefined();
    await links.create(link('old'));
    await links.create({ ...link('new'), createdAt: new Date('2026-11-06T10:05:00Z') });
    await links.create(link('reset', 'reset_password'));
    expect(await links.latestCreatedAt(user().id, 'verify_email')).toEqual(new Date('2026-11-06T10:05:00Z'));

    await links.revokeAll(user().id, 'verify_email');
    expect(await links.consume('old', 'verify_email', now)).toBeUndefined();
    expect(await links.consume('new', 'verify_email', now)).toBeUndefined();
    expect(await links.consume('reset', 'reset_password', now)).toBe(user().id);
  });

  it('refuses a purpose the database does not know', async () => {
    await new DrizzleUserGateway(db()).save(user());
    await expect(
      db().execute(sql`insert into app.auth_tokens (token_hash, user_id, purpose, created_at, expires_at) values ('h', ${user().id}, 'other', now(), now())`),
    ).rejects.toThrow();
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
