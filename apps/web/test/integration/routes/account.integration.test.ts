import { beforeEach, describe, expect, it } from 'vitest';
import { GET as googleCallback } from '../../../app/api/v1/auth/google/callback/route';
import { GET as googleStart } from '../../../app/api/v1/auth/google/start/route';
import { GET as me } from '../../../app/api/v1/auth/me/route';
import { POST as forgot } from '../../../app/api/v1/auth/password/forgot/route';
import { POST as reset } from '../../../app/api/v1/auth/password/reset/route';
import { POST as signin } from '../../../app/api/v1/auth/signin/route';
import { POST as confirm } from '../../../app/api/v1/auth/verification/confirm/route';
import { POST as resend } from '../../../app/api/v1/auth/verification/resend/route';
import { GET as templates } from '../../../app/api/v1/templates/route';
import { capturedEmails, clearCapturedEmails } from '@/adapters/shared/memory-email-gateway';
import { useTestDb } from '../setup';
import { adminWithPlan, linkTokenFor, request, signUpUnverified } from '../support/api';

const db = useTestDb();

beforeEach(() => {
  clearCapturedEmails();
  process.env.APP_URL = 'https://nestwise.test';
});

const tokenFrom = (response: Response) => /nw_session=([^;]*)/.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '';
const whoAmI = async (token: string) => (await me(request('GET', '/api/v1/auth/me', token))).json() as Promise<{ user: { emailVerified: boolean } }>;

describe('email verification', () => {
  it('emails a link to the app on sign-up; opening it verifies the email', async () => {
    const { token } = await signUpUnverified('priya@example.com');
    const [mail] = capturedEmails();
    expect(mail).toMatchObject({ to: 'priya@example.com', subject: 'Verify your email for NestWise' });
    expect(mail!.text).toMatch(/https:\/\/nestwise\.test\/verify-email\/confirm\?token=[A-Za-z0-9_-]{43}/);
    expect((await whoAmI(token)).user.emailVerified).toBe(false);

    const response = await confirm(request('POST', '/api/v1/auth/verification/confirm', undefined, { token: linkTokenFor('priya@example.com', '/verify-email/confirm') }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: 'priya@example.com' });
    expect((await whoAmI(token)).user.emailVerified).toBe(true);
  });

  it('refuses a used or made-up link (422) and a malformed body (400)', async () => {
    await signUpUnverified('priya@example.com');
    const token = linkTokenFor('priya@example.com', '/verify-email/confirm');
    await confirm(request('POST', '/api/v1/auth/verification/confirm', undefined, { token }));
    const again = await confirm(request('POST', '/api/v1/auth/verification/confirm', undefined, { token }));
    expect(again.status).toBe(422);
    expect(await again.json()).toMatchObject({ error: { code: 'InvalidAuthLinkError' } });
    expect((await confirm(request('POST', '/api/v1/auth/verification/confirm', undefined, { token: 'made-up' }))).status).toBe(422);
    expect((await confirm(request('POST', '/api/v1/auth/verification/confirm', undefined, {}))).status).toBe(400);
  });

  it('keeps an unverified account out of family data (403)', async () => {
    const admin = await adminWithPlan(db());
    expect((await templates(request('GET', '/api/v1/templates', admin.token))).status).toBe(200);
    const { token } = await signUpUnverified('newcomer@example.com');
    const response = await templates(request('GET', '/api/v1/templates', token));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'EmailNotVerifiedError' } });
  });

  it('resends only after a minute (or says it is too soon), and needs a session', async () => {
    const { token } = await signUpUnverified('priya@example.com');
    const tooSoon = await resend(request('POST', '/api/v1/auth/verification/resend', token, {}));
    expect(await tooSoon.json()).toEqual({ result: 'too_soon' });
    expect(capturedEmails()).toHaveLength(1);
    expect((await resend(request('POST', '/api/v1/auth/verification/resend', undefined, {}))).status).toBe(401);
  });
});

describe('forgot and reset password', () => {
  it('answers 202 the same for a known and an unknown email, and emails only the known one', async () => {
    await signUpUnverified('priya@example.com');
    clearCapturedEmails();
    const known = await forgot(request('POST', '/api/v1/auth/password/forgot', undefined, { email: 'Priya@example.com' }));
    const unknown = await forgot(request('POST', '/api/v1/auth/password/forgot', undefined, { email: 'nobody@example.com' }));
    expect([known.status, unknown.status]).toEqual([202, 202]);
    expect(await known.json()).toEqual(await unknown.json());
    expect(capturedEmails().map((m) => [m.to, m.subject])).toEqual([['priya@example.com', 'Reset your NestWise password']]);
    expect(capturedEmails()[0]!.text).toMatch(/https:\/\/nestwise\.test\/reset-password\?token=/);
  });

  it('sets the new password once, signs out other sessions, and signs this browser in', async () => {
    const { token: oldSession } = await signUpUnverified('priya@example.com');
    await forgot(request('POST', '/api/v1/auth/password/forgot', undefined, { email: 'priya@example.com' }));
    const link = linkTokenFor('priya@example.com', '/reset-password');

    const short = await reset(request('POST', '/api/v1/auth/password/reset', undefined, { token: link, password: 'short' }));
    expect(short.status).toBe(422);

    const response = await reset(request('POST', '/api/v1/auth/password/reset', undefined, { token: link, password: 'new-horse-battery' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { email: 'priya@example.com', emailVerified: true } });
    expect((await whoAmI(tokenFrom(response))).user.emailVerified).toBe(true);
    expect((await me(request('GET', '/api/v1/auth/me', oldSession))).status).toBe(401);

    expect((await signin(request('POST', '/api/v1/auth/signin', undefined, { email: 'priya@example.com', password: 'correct-horse' }))).status).toBe(401);
    expect((await signin(request('POST', '/api/v1/auth/signin', undefined, { email: 'priya@example.com', password: 'new-horse-battery' }))).status).toBe(200);
    expect((await reset(request('POST', '/api/v1/auth/password/reset', undefined, { token: link, password: 'other-horse-battery' }))).status).toBe(422);
  });
});

describe('Google sign-in routes', () => {
  const withGoogle = async (env: Record<string, string | undefined>, run: () => Promise<void>) => {
    const set = (values: Record<string, string | undefined>) => {
      for (const [k, v] of Object.entries(values)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    };
    const saved = { GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET };
    set(env);
    try {
      await run();
    } finally {
      set(saved);
    }
  };

  it('sends the person to Google with state and PKCE, remembering them in a short HttpOnly cookie', async () => {
    await withGoogle({ GOOGLE_CLIENT_ID: 'client-test', GOOGLE_CLIENT_SECRET: 'secret-test' }, async () => {
      const response = await googleStart(new Request('https://nestwise.test/api/v1/auth/google/start?next=/join/abc'));
      expect(response.status).toBe(303);
      const location = new URL(response.headers.get('location')!);
      expect(location.origin).toBe('https://accounts.google.com');
      expect(location.searchParams.get('client_id')).toBe('client-test');
      expect(location.searchParams.get('redirect_uri')).toBe('https://nestwise.test/api/v1/auth/google/callback');
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');
      const cookie = response.headers.get('set-cookie')!;
      expect(cookie).toMatch(/^nw_google=.*HttpOnly; Secure; SameSite=Lax; Max-Age=600$/);
      expect(decodeURIComponent(cookie)).toContain(`"state":"${location.searchParams.get('state')}"`);
      expect(decodeURIComponent(cookie)).toContain('"next":"/join/abc"');
    });
  });

  it('goes back to sign-in with a message when Google is not set up', async () => {
    await withGoogle({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined }, async () => {
      const response = await googleStart(new Request('https://nestwise.test/api/v1/auth/google/start'));
      expect(response.headers.get('location')).toBe('/sign-in?error=google_unavailable');
    });
  });

  it('refuses a callback whose state does not match, or that Google cancelled, without signing in', async () => {
    const cookie = `nw_google=${encodeURIComponent(JSON.stringify({ state: 'right', verifier: 'v', next: '/home' }))}`;
    const wrong = await googleCallback(new Request('https://nestwise.test/api/v1/auth/google/callback?code=c&state=wrong', { headers: { cookie } }));
    expect(wrong.headers.get('location')).toBe('/sign-in?error=google');
    expect(wrong.headers.get('set-cookie')).not.toMatch(/nw_session=[^;]/);
    const missing = await googleCallback(new Request('https://nestwise.test/api/v1/auth/google/callback?code=c&state=right'));
    expect(missing.headers.get('location')).toBe('/sign-in?error=google');
    const cancelled = await googleCallback(new Request('https://nestwise.test/api/v1/auth/google/callback?error=access_denied&state=right', { headers: { cookie } }));
    expect(cancelled.headers.get('location')).toBe('/sign-in?error=google_cancelled');
  });
});
