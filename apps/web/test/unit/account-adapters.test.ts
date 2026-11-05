import { GoogleSignInFailedError } from '@nestwise/domain/auth';
import type { EmailGateway } from '@nestwise/domain/reminders';
import { describe, expect, it } from 'vitest';
import { AccountEmailSender } from '@/adapters/auth/account-email-sender';
import { googleAuthorizeUrl, googleClient, GoogleOAuthIdentityGateway } from '@/adapters/auth/google-oauth-identity-gateway';
import { appOrigin } from '@/http/app-origin';
import { googleRoundTripCookie, readGoogleRoundTrip } from '@/http/session-cookie';

const client = { clientId: 'client-abc.apps.googleusercontent.com', clientSecret: 'test-secret', redirectUri: 'https://nestwise.test/api/v1/auth/google/callback' };
const now = new Date('2026-11-06T10:00:00Z');
const seconds = now.getTime() / 1000;

const jwt = (payload: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
const goodPayload = { iss: 'https://accounts.google.com', aud: client.clientId, exp: seconds + 600, sub: '1234', email: 'Priya@Example.com', email_verified: true };

function googleReplying(status: number, body: unknown) {
  const calls: { url: string; body: string }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, gateway: new GoogleOAuthIdentityGateway(client, fetchFn, () => now) };
}

describe('GoogleOAuthIdentityGateway', () => {
  it('swaps the code (with the PKCE verifier) for the identity in the ID token', async () => {
    const { calls, gateway } = googleReplying(200, { id_token: jwt(goodPayload) });
    expect(await gateway.identityFor('code-1', 'verifier-1')).toEqual({ subject: '1234', email: 'Priya@Example.com', emailVerified: true });
    expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/token');
    const sent = new URLSearchParams(calls[0]!.body);
    expect(Object.fromEntries(sent)).toEqual({
      code: 'code-1',
      code_verifier: 'verifier-1',
      client_id: client.clientId,
      client_secret: 'test-secret',
      redirect_uri: client.redirectUri,
      grant_type: 'authorization_code',
    });
  });

  it('refuses a token for another app, from another issuer, expired, or without an email', async () => {
    for (const payload of [
      { ...goodPayload, aud: 'someone-else' },
      { ...goodPayload, iss: 'https://evil.example' },
      { ...goodPayload, exp: seconds - 1 },
      { ...goodPayload, email: undefined },
    ]) {
      await expect(googleReplying(200, { id_token: jwt(payload) }).gateway.identityFor('c', 'v')).rejects.toBeInstanceOf(GoogleSignInFailedError);
    }
  });

  it('turns a refusal from Google into GoogleSignInFailedError', async () => {
    await expect(googleReplying(400, { error: 'invalid_grant' }).gateway.identityFor('c', 'v')).rejects.toBeInstanceOf(GoogleSignInFailedError);
    await expect(googleReplying(200, { id_token: 'not-a-jwt' }).gateway.identityFor('c', 'v')).rejects.toBeInstanceOf(GoogleSignInFailedError);
  });

  it('reads an unverified email as unverified', async () => {
    const { gateway } = googleReplying(200, { id_token: jwt({ ...goodPayload, email_verified: false }) });
    expect((await gateway.identityFor('c', 'v')).emailVerified).toBe(false);
  });
});

describe('googleClient and googleAuthorizeUrl', () => {
  it('is off without both settings', () => {
    expect(googleClient(client.redirectUri, {})).toBeUndefined();
    expect(googleClient(client.redirectUri, { GOOGLE_CLIENT_ID: 'x' })).toBeUndefined();
    expect(googleClient(client.redirectUri, { GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' })).toEqual({ clientId: 'x', clientSecret: 'y', redirectUri: client.redirectUri });
  });

  it('asks Google for name and email only, with state and an S256 challenge', () => {
    const url = new URL(googleAuthorizeUrl(client, 'state-1', 'challenge-1'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'state-1',
      code_challenge: 'challenge-1',
      code_challenge_method: 'S256',
    });
    expect(url.searchParams.has('client_secret')).toBe(false);
  });
});

describe('AccountEmailSender', () => {
  class Recording implements EmailGateway {
    sent: { to: string; subject: string; text: string }[] = [];
    constructor(private readonly answer: boolean | 'throw' = true) {}
    async send(to: string, subject: string, text: string) {
      if (this.answer === 'throw') throw new Error('SMTP down');
      this.sent.push({ to, subject, text });
      return this.answer;
    }
  }

  it('writes the verify email with a link to the app, carrying the return path', async () => {
    const email = new Recording();
    await new AccountEmailSender(email, 'https://nestwise.test', true).sendVerifyEmail('priya@example.com', 'tok-1', '/join/abc');
    expect(email.sent[0]).toMatchObject({ to: 'priya@example.com', subject: 'Verify your email for NestWise' });
    expect(email.sent[0]!.text).toContain('https://nestwise.test/verify-email/confirm?token=tok-1&next=%2Fjoin%2Fabc');
    expect(email.sent[0]!.text).toContain('24 hours');
  });

  it('writes the reset email with its one-hour link', async () => {
    const email = new Recording();
    await new AccountEmailSender(email, 'https://nestwise.test', true).sendPasswordReset('priya@example.com', 'tok-2');
    expect(email.sent[0]!.subject).toBe('Reset your NestWise password');
    expect(email.sent[0]!.text).toContain('https://nestwise.test/reset-password?token=tok-2');
    expect(email.sent[0]!.text).toContain('60 minutes');
  });

  it('never throws when sending fails', async () => {
    await expect(new AccountEmailSender(new Recording('throw'), 'https://nestwise.test', true).sendPasswordReset('a@b.co', 't')).resolves.toBeUndefined();
  });
});

describe('appOrigin', () => {
  const request = new Request('http://localhost:3000/api/v1/auth/signup');
  it('prefers APP_URL, without a trailing slash', () => {
    expect(appOrigin(request, { APP_URL: 'https://nestwise-alpha.vercel.app/' })).toBe('https://nestwise-alpha.vercel.app');
  });
  it('falls back to the request outside production, and refuses to in production', () => {
    expect(appOrigin(request, {})).toBe('http://localhost:3000');
    expect(() => appOrigin(request, { NODE_ENV: 'production' })).toThrow(/APP_URL/);
    expect(() => appOrigin(request, { VERCEL_ENV: 'production' })).toThrow(/APP_URL/);
  });
});

describe('Google round-trip cookie', () => {
  it('round-trips, is HttpOnly and scoped to the Google routes, and ignores junk', () => {
    const request = new Request('https://nestwise.test/api/v1/auth/google/start');
    const cookie = googleRoundTripCookie(request, { state: 's1', verifier: 'v1', next: '/join/abc' });
    expect(cookie).toMatch(/^nw_google=.*; Path=\/api\/v1\/auth\/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600$/);
    const value = cookie.split(';')[0]!;
    expect(readGoogleRoundTrip(new Request('https://nestwise.test/x', { headers: { cookie: `other=1; ${value}` } }))).toEqual({
      state: 's1',
      verifier: 'v1',
      next: '/join/abc',
    });
    expect(readGoogleRoundTrip(new Request('https://nestwise.test/x', { headers: { cookie: 'nw_google=%7Bbad' } }))).toBeUndefined();
    expect(readGoogleRoundTrip(new Request('https://nestwise.test/x'))).toBeUndefined();
  });
});
