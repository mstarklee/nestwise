import { randomUUID } from 'node:crypto';
import type { Db } from '@nestwise/db';
import type { Role } from '@nestwise/domain/shared';
import { importPlan } from '../../../../../scripts/import-plan';
import { POST as signup } from '../../../app/api/v1/auth/signup/route';
import { POST as createFamily } from '../../../app/api/v1/families/route';
import { POST as acceptInvite } from '../../../app/api/v1/invites/[token]/accept/route';
import { POST as createInvite } from '../../../app/api/v1/invites/route';
import { DrizzlePlanGateway } from '@/adapters/plan/drizzle-plan-gateway';

/** Route-test helpers: requests with a session cookie, sign-up, and a signed-in admin whose family has the sample plan. */
export const request = (method: string, url: string, token?: string, body?: unknown) =>
  new Request(`https://nestwise.test${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { cookie: `nw_session=${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

export async function signUp(email: string): Promise<{ token: string; userId: string }> {
  const response = await signup(request('POST', '/api/v1/auth/signup', undefined, { email, password: 'correct-horse' }));
  const token = /nw_session=([^;]*)/.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '';
  const { user } = (await response.json()) as { user: { id: string } };
  return { token, userId: user.id };
}

export async function adminWithPlan(db: Db) {
  const email = `${randomUUID()}@example.com`;
  process.env.ALLOWED_SIGNUP_EMAILS = email;
  const { token, userId } = await signUp(email);
  const created = await createFamily(
    request('POST', '/api/v1/families', token, { name: 'Our Family', currencyCode: 'INR', timeZone: 'Asia/Kolkata', openingPotMinor: 0 }),
  );
  const { family } = (await created.json()) as { family: { id: string } };
  await importPlan({ db, familyId: family.id });
  const items = await new DrizzlePlanGateway(db).listItems(family.id, { includeArchived: true });
  const itemId = (seedKey: string) => items.find((i) => i.seedKey === seedKey)!.id;

  /** Invites a new person with `role` and returns their session token. */
  const join = async (role: Role) => {
    const invite = (await (await createInvite(request('POST', '/api/v1/invites', token, { role }))).json()) as { token: string };
    const person = await signUp(`${randomUUID()}@example.com`);
    await acceptInvite(request('POST', `/api/v1/invites/${invite.token}/accept`, person.token, {}), params({ token: invite.token }));
    return person.token;
  };
  return { token, userId, familyId: family.id, itemId, join };
}
