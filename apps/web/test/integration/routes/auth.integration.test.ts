import { describe, expect, it } from 'vitest';
import { GET as me } from '../../../app/api/v1/auth/me/route';
import { POST as signin } from '../../../app/api/v1/auth/signin/route';
import { POST as signout } from '../../../app/api/v1/auth/signout/route';
import { POST as signup } from '../../../app/api/v1/auth/signup/route';
import { useTestDb } from '../setup';

useTestDb();

const BASE = 'https://nestwise.test/api/v1/auth';
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${BASE}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const get = (path: string, headers: Record<string, string> = {}) => new Request(`${BASE}/${path}`, { headers });

const tokenFrom = (response: Response) => /nw_session=([^;]*)/.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '';
const cookie = (token: string) => ({ cookie: `nw_session=${token}` });

const priya = { email: 'Priya@Example.com', password: 'correct-horse' };

describe('/api/v1/auth', () => {
  it('signs up: 201, the user, and an HttpOnly Secure session cookie', async () => {
    const response = await signup(post('signup', priya));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ user: { id: expect.any(String), email: 'priya@example.com' } });
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/^nw_session=[A-Za-z0-9_-]{43};/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Max-Age=15552000/);
  });

  it('refuses a second account for the same email (409), a bad email (422) and a malformed body (400)', async () => {
    await signup(post('signup', priya));
    expect((await signup(post('signup', { ...priya, email: 'PRIYA@example.com' }))).status).toBe(409);
    expect((await signup(post('signup', { ...priya, email: 'nope' }))).status).toBe(422);
    expect((await signup(post('signup', { email: 'x@example.com' }))).status).toBe(400);
  });

  it('tells who is signed in from the cookie or a Bearer token, and 401 otherwise', async () => {
    const token = tokenFrom(await signup(post('signup', priya)));
    const byCookie = await me(get('me', cookie(token)));
    expect(byCookie.status).toBe(200);
    expect(await byCookie.json()).toEqual({ user: { id: expect.any(String), email: 'priya@example.com' } });
    expect((await me(get('me', { authorization: `Bearer ${token}` }))).status).toBe(200);
    expect((await me(get('me'))).status).toBe(401);
    expect((await me(get('me', cookie('made-up')))).status).toBe(401);
  });

  it('signs in with the right password (200 + new cookie) and refuses a wrong one (401)', async () => {
    await signup(post('signup', priya));
    const wrong = await signin(post('signin', { ...priya, password: 'wrong-horse' }));
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get('set-cookie')).toBeNull();
    const right = await signin(post('signin', priya));
    expect(right.status).toBe(200);
    expect(tokenFrom(right)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('signs out: clears the cookie and ends the session', async () => {
    const token = tokenFrom(await signup(post('signup', priya)));
    const response = await signout(post('signout', {}, cookie(token)));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/nw_session=;.*Max-Age=0/);
    expect((await me(get('me', cookie(token)))).status).toBe(401);
  });
});
