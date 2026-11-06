import { beforeEach, describe, expect, it } from 'vitest';
import {
  EmailAlreadyRegisteredError,
  InvalidAuthCommandError,
  InvalidCredentialsError,
  NotSignedInError,
  ResolveSessionUseCase,
  SESSION_DAYS,
  SignInUseCase,
  SignOutUseCase,
  SignUpUseCase,
} from '../../src/auth';
import { FakePasswordHasher } from '../fakes/fake-password-hasher';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryOneTimeTokenGateway, RecordingAccountEmailGateway } from '../fakes/in-memory-account-gateways';
import { InMemorySessionGateway } from '../fakes/in-memory-session-gateway';
import { InMemoryUserGateway } from '../fakes/in-memory-user-gateway';
import { SequentialIds } from '../fakes/sequential-ids';

let users: InMemoryUserGateway;
let sessions: InMemorySessionGateway;
let links: InMemoryOneTimeTokenGateway;
let emails: RecordingAccountEmailGateway;
let clock: FixedClock;
let signUp: SignUpUseCase;
let signIn: SignInUseCase;
let signOut: SignOutUseCase;
let resolve: ResolveSessionUseCase;

beforeEach(() => {
  users = new InMemoryUserGateway();
  sessions = new InMemorySessionGateway();
  links = new InMemoryOneTimeTokenGateway();
  emails = new RecordingAccountEmailGateway();
  clock = new FixedClock('2026-11-02T10:00:00Z');
  const hasher = new FakePasswordHasher();
  const tokens = new SequentialIds('token');
  signUp = new SignUpUseCase(users, sessions, links, hasher, new SequentialIds('user'), tokens, emails, clock);
  signIn = new SignInUseCase(users, sessions, hasher, tokens, clock);
  signOut = new SignOutUseCase(sessions);
  resolve = new ResolveSessionUseCase(users, sessions, clock);
});

describe('SignUpUseCase', () => {
  it('creates an unverified account with a hashed password, emails a verify link, and signs in', async () => {
    const result = await signUp.execute({ email: '  Priya@Example.COM ', password: 'correct-horse' });
    expect(result).toEqual({
      user: { id: 'user-1', email: 'priya@example.com', emailVerified: false },
      token: 'token-2',
      expiresAt: new Date('2027-05-01T10:00:00Z'),
    });
    expect(users.all()).toEqual([
      {
        id: 'user-1',
        email: 'priya@example.com',
        passwordHash: 'hashed:correct-horse',
        emailVerifiedAt: null,
        googleSubject: null,
        createdAt: clock.now(),
      },
    ]);
    expect(sessions.all()).toEqual([{ token: 'token-2', userId: 'user-1', expiresAt: new Date('2027-05-01T10:00:00Z') }]);
    expect(links.all()).toEqual([
      {
        token: 'token-1',
        userId: 'user-1',
        purpose: 'verify_email',
        createdAt: clock.now(),
        expiresAt: new Date('2026-11-03T10:00:00Z'),
        usedAt: null,
        revoked: false,
      },
    ]);
    expect(emails.sent).toEqual([{ kind: 'verify', to: 'priya@example.com', token: 'token-1' }]);
    expect(SESSION_DAYS).toBe(180);
  });

  it('carries a safe return path into the verify email, and drops one that leaves the app', async () => {
    await signUp.execute({ email: 'priya@example.com', password: 'correct-horse', returnTo: '/join/abc' });
    await signUp.execute({ email: 'arun@example.com', password: 'correct-horse', returnTo: '//evil.example/x' });
    expect(emails.sent.map((e) => e.returnTo)).toEqual(['/join/abc', undefined]);
  });

  it('refuses an email that already has an account, whatever its case, and saves or sends nothing new', async () => {
    await signUp.execute({ email: 'priya@example.com', password: 'correct-horse' });
    await expect(signUp.execute({ email: 'PRIYA@example.com', password: 'another-pass' })).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
    expect(users.all()).toHaveLength(1);
    expect(sessions.all()).toHaveLength(1);
    expect(emails.sent).toHaveLength(1);
  });

  it('refuses a bad email or a short or overlong password, and saves nothing', async () => {
    for (const command of [
      { email: 'not-an-email', password: 'correct-horse' },
      { email: 'a@b', password: 'correct-horse' },
      { email: 'priya@example.com', password: 'short' },
      { email: 'priya@example.com', password: 'x'.repeat(201) },
    ]) {
      await expect(signUp.execute(command)).rejects.toBeInstanceOf(InvalidAuthCommandError);
    }
    expect(users.all()).toHaveLength(0);
    expect(sessions.all()).toHaveLength(0);
    expect(emails.sent).toHaveLength(0);
  });

  it('errors have the right categories', () => {
    expect(new EmailAlreadyRegisteredError('x').category).toBe('conflict');
    expect(new InvalidAuthCommandError('x').category).toBe('invalid');
    expect(new InvalidCredentialsError('x').category).toBe('not_signed_in');
    expect(new NotSignedInError('x').category).toBe('not_signed_in');
  });
});

describe('SignInUseCase', () => {
  beforeEach(async () => {
    await signUp.execute({ email: 'priya@example.com', password: 'correct-horse' });
  });

  it('signs in with the right password, any email case, and starts a new session', async () => {
    const result = await signIn.execute({ email: 'Priya@example.com', password: 'correct-horse' });
    expect(result).toMatchObject({ user: { id: 'user-1', email: 'priya@example.com', emailVerified: false }, token: 'token-3' });
    expect(sessions.all().map((s) => s.token)).toEqual(['token-2', 'token-3']);
  });

  it('refuses a password for an account that only signs in with Google', async () => {
    const [priya] = users.all();
    await users.update({ ...priya!, passwordHash: null });
    await expect(signIn.execute({ email: 'priya@example.com', password: 'correct-horse' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('refuses a wrong password or an unknown email with the same error, and starts no session', async () => {
    await expect(signIn.execute({ email: 'priya@example.com', password: 'wrong-horse' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(signIn.execute({ email: 'nobody@example.com', password: 'correct-horse' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    expect(sessions.all()).toHaveLength(1);
  });
});

describe('ResolveSessionUseCase and SignOutUseCase', () => {
  it('resolves a live session to its user', async () => {
    const { token } = await signUp.execute({ email: 'priya@example.com', password: 'correct-horse' });
    expect(await resolve.execute({ token })).toEqual({ userId: 'user-1', email: 'priya@example.com', emailVerified: false });
    const [priya] = users.all();
    await users.update({ ...priya!, emailVerifiedAt: clock.now() });
    expect(await resolve.execute({ token })).toMatchObject({ emailVerified: true });
  });

  it('refuses a missing, unknown or expired token', async () => {
    const { token } = await signUp.execute({ email: 'priya@example.com', password: 'correct-horse' });
    await expect(resolve.execute({ token: null })).rejects.toBeInstanceOf(NotSignedInError);
    await expect(resolve.execute({ token: 'made-up' })).rejects.toBeInstanceOf(NotSignedInError);
    clock.set('2027-05-01T10:00:01Z');
    await expect(resolve.execute({ token })).rejects.toBeInstanceOf(NotSignedInError);
  });

  it('signing out ends that session only, and is safe to repeat', async () => {
    const first = await signUp.execute({ email: 'priya@example.com', password: 'correct-horse' });
    const second = await signIn.execute({ email: 'priya@example.com', password: 'correct-horse' });
    await signOut.execute({ token: first.token });
    await signOut.execute({ token: first.token });
    await expect(resolve.execute({ token: first.token })).rejects.toBeInstanceOf(NotSignedInError);
    expect(await resolve.execute({ token: second.token })).toMatchObject({ userId: 'user-1' });
  });
});
