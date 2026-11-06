import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConfirmEmailUseCase,
  EmailNotVerifiedError,
  GoogleAccountConflictError,
  GoogleSignInFailedError,
  InvalidAuthCommandError,
  InvalidAuthLinkError,
  NotSignedInError,
  RequestPasswordResetUseCase,
  ResendVerificationUseCase,
  ResetPasswordUseCase,
  ResolveSessionUseCase,
  SignInUseCase,
  SignInWithGoogleUseCase,
  SignUpUseCase,
  assertEmailVerified,
  safeReturnTo,
} from '../../src/auth';
import { FakePasswordHasher } from '../fakes/fake-password-hasher';
import { FixedClock } from '../fakes/fixed-clock';
import {
  FakeGoogleIdentityGateway,
  InMemoryOneTimeTokenGateway,
  RecordingAccountEmailGateway,
} from '../fakes/in-memory-account-gateways';
import { InMemorySessionGateway } from '../fakes/in-memory-session-gateway';
import { InMemoryUserGateway } from '../fakes/in-memory-user-gateway';
import { SequentialIds } from '../fakes/sequential-ids';

let users: InMemoryUserGateway;
let sessions: InMemorySessionGateway;
let links: InMemoryOneTimeTokenGateway;
let emails: RecordingAccountEmailGateway;
let google: FakeGoogleIdentityGateway;
let clock: FixedClock;
let signUp: SignUpUseCase;
let signIn: SignInUseCase;
let resolve: ResolveSessionUseCase;
let confirm: ConfirmEmailUseCase;
let resend: ResendVerificationUseCase;
let forgot: RequestPasswordResetUseCase;
let reset: ResetPasswordUseCase;
let withGoogle: SignInWithGoogleUseCase;

beforeEach(() => {
  users = new InMemoryUserGateway();
  sessions = new InMemorySessionGateway();
  links = new InMemoryOneTimeTokenGateway();
  emails = new RecordingAccountEmailGateway();
  google = new FakeGoogleIdentityGateway();
  clock = new FixedClock('2026-11-06T10:00:00Z');
  const hasher = new FakePasswordHasher();
  const tokens = new SequentialIds('token');
  const ids = new SequentialIds('user');
  signUp = new SignUpUseCase(users, sessions, links, hasher, ids, tokens, emails, clock);
  signIn = new SignInUseCase(users, sessions, hasher, tokens, clock);
  resolve = new ResolveSessionUseCase(users, sessions, clock);
  confirm = new ConfirmEmailUseCase(users, links, clock);
  resend = new ResendVerificationUseCase(users, links, tokens, emails, clock);
  forgot = new RequestPasswordResetUseCase(users, links, tokens, emails, clock);
  reset = new ResetPasswordUseCase(users, sessions, links, hasher, tokens, clock);
  withGoogle = new SignInWithGoogleUseCase(users, sessions, links, google, ids, tokens, clock);
});

const priya = { email: 'priya@example.com', password: 'correct-horse' };
const lastToken = () => emails.last()!.token;
const user = async () => (await users.findByEmail('priya@example.com'))!;

describe('assertEmailVerified and safeReturnTo', () => {
  it('lets a verified user through and stops an unverified one', () => {
    expect(() => assertEmailVerified({ userId: 'u', email: 'a@b.co', emailVerified: true })).not.toThrow();
    expect(() => assertEmailVerified({ userId: 'u', email: 'a@b.co', emailVerified: false })).toThrow(EmailNotVerifiedError);
    expect(new EmailNotVerifiedError('x').category).toBe('not_allowed');
  });

  it('keeps only paths inside the app', () => {
    expect(safeReturnTo('/join/abc?x=1')).toBe('/join/abc?x=1');
    for (const bad of [undefined, null, '', 'home', '//evil.example', '/\\evil.example', 'https://evil.example', `/${'x'.repeat(600)}`]) {
      expect(safeReturnTo(bad)).toBeUndefined();
    }
  });
});

describe('ConfirmEmailUseCase', () => {
  it('marks the email verified, once, and the session then shows it', async () => {
    const { token: session } = await signUp.execute(priya);
    clock.set('2026-11-06T12:00:00Z');
    expect(await confirm.execute({ token: lastToken() })).toEqual({ email: 'priya@example.com' });
    expect((await user()).emailVerifiedAt).toEqual(new Date('2026-11-06T12:00:00Z'));
    expect(await resolve.execute({ token: session })).toMatchObject({ emailVerified: true });
    await expect(confirm.execute({ token: lastToken() })).rejects.toBeInstanceOf(InvalidAuthLinkError);
  });

  it('refuses an unknown or expired link and verifies nothing', async () => {
    await signUp.execute(priya);
    await expect(confirm.execute({ token: 'made-up' })).rejects.toBeInstanceOf(InvalidAuthLinkError);
    clock.set('2026-11-07T10:00:01Z'); // just past 24 hours
    await expect(confirm.execute({ token: lastToken() })).rejects.toBeInstanceOf(InvalidAuthLinkError);
    expect((await user()).emailVerifiedAt).toBeNull();
  });

  it('does not accept a reset link as a verify link', async () => {
    await signUp.execute(priya);
    clock.set('2026-11-06T10:05:00Z');
    await forgot.execute({ email: priya.email });
    await expect(confirm.execute({ token: lastToken() })).rejects.toBeInstanceOf(InvalidAuthLinkError);
  });
});

describe('ResendVerificationUseCase', () => {
  it('sends a fresh link after a minute, and the old link stops working', async () => {
    const { user: created } = await signUp.execute({ ...priya, returnTo: '/join/abc' });
    const first = lastToken();
    clock.set('2026-11-06T10:00:30Z');
    expect(await resend.execute({ userId: created.id })).toBe('too_soon');
    expect(emails.sent).toHaveLength(1);

    clock.set('2026-11-06T10:01:00Z');
    expect(await resend.execute({ userId: created.id, returnTo: '/join/abc' })).toBe('sent');
    expect(emails.last()).toMatchObject({ kind: 'verify', to: 'priya@example.com', returnTo: '/join/abc' });
    await expect(confirm.execute({ token: first })).rejects.toBeInstanceOf(InvalidAuthLinkError);
    await confirm.execute({ token: lastToken() });
    expect(await resend.execute({ userId: created.id })).toBe('already_verified');
    expect(emails.sent).toHaveLength(2);
  });

  it('refuses a user that does not exist', async () => {
    await expect(resend.execute({ userId: 'nobody' })).rejects.toBeInstanceOf(NotSignedInError);
  });
});

describe('RequestPasswordResetUseCase and ResetPasswordUseCase', () => {
  beforeEach(async () => {
    await signUp.execute(priya);
    clock.set('2026-11-06T10:05:00Z');
  });

  it('emails a reset link only for a known email, and says nothing either way', async () => {
    await forgot.execute({ email: ' PRIYA@example.com ' });
    expect(emails.last()).toMatchObject({ kind: 'reset', to: 'priya@example.com' });
    expect(links.all().at(-1)).toMatchObject({ purpose: 'reset_password', expiresAt: new Date('2026-11-06T11:05:00Z') });
    const sent = emails.sent.length;
    await expect(forgot.execute({ email: 'nobody@example.com' })).resolves.toBeUndefined();
    expect(emails.sent).toHaveLength(sent);
    await expect(forgot.execute({ email: 'not-an-email' })).rejects.toBeInstanceOf(InvalidAuthCommandError);
  });

  it('sends at most one reset email a minute', async () => {
    await forgot.execute({ email: priya.email });
    clock.set('2026-11-06T10:05:59Z');
    await forgot.execute({ email: priya.email });
    expect(emails.sent.filter((e) => e.kind === 'reset')).toHaveLength(1);
  });

  it('sets the new password, verifies the email, signs out everywhere and signs this browser in', async () => {
    const other = await signIn.execute(priya);
    await forgot.execute({ email: priya.email });
    clock.set('2026-11-06T10:30:00Z');

    const result = await reset.execute({ token: lastToken(), password: 'new-horse-battery' });
    expect(result.user).toEqual({ id: (await user()).id, email: 'priya@example.com', emailVerified: true });
    expect((await user()).passwordHash).toBe('hashed:new-horse-battery');
    expect((await user()).emailVerifiedAt).toEqual(new Date('2026-11-06T10:30:00Z'));
    await expect(resolve.execute({ token: other.token })).rejects.toBeInstanceOf(NotSignedInError);
    expect(sessions.all().map((s) => s.token)).toEqual([result.token]);
    await expect(signIn.execute(priya)).rejects.toThrow();
    await expect(signIn.execute({ ...priya, password: 'new-horse-battery' })).resolves.toBeDefined();
  });

  it('works once, and not after an hour', async () => {
    await forgot.execute({ email: priya.email });
    const token = lastToken();
    await reset.execute({ token, password: 'new-horse-battery' });
    await expect(reset.execute({ token, password: 'other-horse-battery' })).rejects.toBeInstanceOf(InvalidAuthLinkError);

    clock.set('2026-11-06T10:07:00Z');
    await forgot.execute({ email: priya.email });
    clock.set('2026-11-06T11:07:01Z');
    await expect(reset.execute({ token: lastToken(), password: 'other-horse-battery' })).rejects.toBeInstanceOf(InvalidAuthLinkError);
    expect((await user()).passwordHash).toBe('hashed:new-horse-battery');
  });

  it('checks the new password before using up the link', async () => {
    await forgot.execute({ email: priya.email });
    await expect(reset.execute({ token: lastToken(), password: 'short' })).rejects.toBeInstanceOf(InvalidAuthCommandError);
    await expect(reset.execute({ token: lastToken(), password: 'new-horse-battery' })).resolves.toBeDefined();
  });
});

describe('SignInWithGoogleUseCase', () => {
  const identity = { subject: 'google-123', email: 'Priya@Example.com', emailVerified: true };

  it('creates a verified, password-less account for a new person and signs in', async () => {
    google.willAccept('code-1', 'verifier-1', identity);
    const result = await withGoogle.execute({ code: 'code-1', codeVerifier: 'verifier-1' });
    expect(result.user).toEqual({ id: 'user-1', email: 'priya@example.com', emailVerified: true });
    expect(users.all()).toEqual([
      {
        id: 'user-1',
        email: 'priya@example.com',
        passwordHash: null,
        emailVerifiedAt: clock.now(),
        googleSubject: 'google-123',
        createdAt: clock.now(),
      },
    ]);
    expect(await resolve.execute({ token: result.token })).toMatchObject({ userId: 'user-1', emailVerified: true });
  });

  it('joins a verified account with the same email and keeps its password and sessions', async () => {
    const { token: session } = await signUp.execute(priya);
    await confirm.execute({ token: lastToken() });
    google.willAccept('code-1', 'verifier-1', identity);

    const result = await withGoogle.execute({ code: 'code-1', codeVerifier: 'verifier-1' });
    expect(result.user.id).toBe('user-1');
    expect(users.all()).toHaveLength(1);
    expect(await user()).toMatchObject({ googleSubject: 'google-123', passwordHash: 'hashed:correct-horse' });
    expect(await resolve.execute({ token: session })).toMatchObject({ userId: 'user-1' });
  });

  it('joins a never-verified account but removes its password, its sessions and its links', async () => {
    const { token: squatter } = await signUp.execute(priya);
    const verifyLink = lastToken();
    google.willAccept('code-1', 'verifier-1', identity);

    const result = await withGoogle.execute({ code: 'code-1', codeVerifier: 'verifier-1' });
    expect(await user()).toMatchObject({ passwordHash: null, emailVerifiedAt: clock.now(), googleSubject: 'google-123' });
    await expect(resolve.execute({ token: squatter })).rejects.toBeInstanceOf(NotSignedInError);
    await expect(confirm.execute({ token: verifyLink })).rejects.toBeInstanceOf(InvalidAuthLinkError);
    expect(await resolve.execute({ token: result.token })).toMatchObject({ emailVerified: true });
  });

  it('finds a joined account by its Google id next time, even if the Google email changed', async () => {
    google.willAccept('code-1', 'verifier-1', identity);
    await withGoogle.execute({ code: 'code-1', codeVerifier: 'verifier-1' });
    google.willAccept('code-2', 'verifier-2', { ...identity, email: 'priya.new@example.com' });
    const again = await withGoogle.execute({ code: 'code-2', codeVerifier: 'verifier-2' });
    expect(again.user).toMatchObject({ id: 'user-1', email: 'priya@example.com' });
    expect(users.all()).toHaveLength(1);
  });

  it('refuses an unverified Google email, a wrong code, and an email joined to another Google account', async () => {
    google.willAccept('code-1', 'verifier-1', { ...identity, emailVerified: false });
    await expect(withGoogle.execute({ code: 'code-1', codeVerifier: 'verifier-1' })).rejects.toBeInstanceOf(GoogleSignInFailedError);
    await expect(withGoogle.execute({ code: 'nope', codeVerifier: 'verifier-1' })).rejects.toBeInstanceOf(GoogleSignInFailedError);
    expect(users.all()).toHaveLength(0);

    google.willAccept('code-2', 'verifier-2', identity);
    await withGoogle.execute({ code: 'code-2', codeVerifier: 'verifier-2' });
    google.willAccept('code-3', 'verifier-3', { ...identity, subject: 'google-other' });
    await expect(withGoogle.execute({ code: 'code-3', codeVerifier: 'verifier-3' })).rejects.toBeInstanceOf(GoogleAccountConflictError);
    expect(await user()).toMatchObject({ googleSubject: 'google-123' });
  });
});
