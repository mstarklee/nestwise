import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as signup } from '../../../app/api/v1/auth/signup/route';
import { POST as createFamily } from '../../../app/api/v1/families/route';
import { POST as acceptInvite } from '../../../app/api/v1/invites/[token]/accept/route';
import { POST as createInvite } from '../../../app/api/v1/invites/route';
import { useTestDb } from '../setup';
import { signUpUnverified, verifyEmailOf } from '../support/api';

useTestDb();

const json = (url: string, body: unknown, token?: string) =>
  new Request(`https://nestwise.test${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { cookie: `nw_session=${token}` } : {}) },
    body: JSON.stringify(body),
  });

async function signUp(email: string): Promise<string> {
  const response = await signup(json('/api/v1/auth/signup', { email, password: 'correct-horse' }));
  await verifyEmailOf(email);
  return /nw_session=([^;]*)/.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '';
}

const family = { name: 'Our Family', currencyCode: 'INR', timeZone: 'Asia/Kolkata', countryCode: 'IN', openingPotMinor: 0 };
const params = (token: string) => ({ params: Promise.resolve({ token }) });

let savedAllowList: string | undefined;
beforeEach(() => {
  savedAllowList = process.env.ALLOWED_SIGNUP_EMAILS;
  process.env.SIGNUP_MODE = 'invite';
  process.env.ALLOWED_SIGNUP_EMAILS = 'priya@example.com';
});
afterEach(() => {
  process.env.ALLOWED_SIGNUP_EMAILS = savedAllowList;
});

describe('POST /api/v1/families', () => {
  it('401 without a session', async () => {
    expect((await createFamily(json('/api/v1/families', family))).status).toBe(401);
  });

  it('403 for an allowed user whose email is not verified yet', async () => {
    const { token } = await signUpUnverified('priya@example.com');
    const response = await createFamily(json('/api/v1/families', family, token));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'EmailNotVerifiedError' } });
  });

  it('403 for a signed-in user who is not on the allow-list', async () => {
    const token = await signUp('stranger@example.com');
    const response = await createFamily(json('/api/v1/families', family, token));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'SignupClosedError' } });
  });

  it('201 with the family for an allowed user; a bad currency is 422 and a malformed body 400', async () => {
    const token = await signUp('priya@example.com');
    expect((await createFamily(json('/api/v1/families', { ...family, currencyCode: 'XYZ' }, token))).status).toBe(422);
    expect((await createFamily(json('/api/v1/families', { name: 'x' }, token))).status).toBe(400);

    const response = await createFamily(json('/api/v1/families', family, token));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      family: {
        id: expect.any(String),
        name: 'Our Family',
        currencyCode: 'INR',
        minorUnit: 2,
        numberLocale: 'en-IN',
        timeZone: 'Asia/Kolkata',
        countryCode: 'IN',
      },
      role: 'admin',
    });
  });
});

describe('invites', () => {
  it('the admin invites the spouse, who joins once; a second use is 409', async () => {
    const priya = await signUp('priya@example.com');
    await createFamily(json('/api/v1/families', family, priya));

    const invited = await createInvite(json('/api/v1/invites', { role: 'admin' }, priya));
    expect(invited.status).toBe(201);
    const invite = (await invited.json()) as { token: string; expiresAt: string; joinPath: string };
    expect(invite.joinPath).toBe(`/join/${invite.token}`);

    const arun = await signUp('arun@example.com'); // not on the allow-list: joins by invite
    const joined = await acceptInvite(json(`/api/v1/invites/${invite.token}/accept`, {}, arun), params(invite.token));
    expect(joined.status).toBe(201);
    expect(await joined.json()).toEqual({ familyId: expect.any(String), role: 'admin' });

    const kavi = await signUp('kavi@example.com');
    expect((await acceptInvite(json(`/api/v1/invites/${invite.token}/accept`, {}, kavi), params(invite.token))).status).toBe(409);
  });

  it('someone with no family cannot invite (403); an unknown invite is 404', async () => {
    const stranger = await signUp('stranger@example.com');
    expect((await createInvite(json('/api/v1/invites', { role: 'member' }, stranger))).status).toBe(403);
    expect((await acceptInvite(json('/api/v1/invites/nope/accept', {}, stranger), params('nope'))).status).toBe(404);
  });
});
