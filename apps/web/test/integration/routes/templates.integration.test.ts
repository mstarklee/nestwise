import { describe, expect, it } from 'vitest';
import { importPlan } from '../../../../../scripts/import-plan';
import { POST as signup } from '../../../app/api/v1/auth/signup/route';
import { POST as createFamily } from '../../../app/api/v1/families/route';
import { POST as acceptInvite } from '../../../app/api/v1/invites/[token]/accept/route';
import { POST as createInvite } from '../../../app/api/v1/invites/route';
import { POST as reorder } from '../../../app/api/v1/templates/groups/[id]/order/route';
import { POST as archive } from '../../../app/api/v1/templates/items/[id]/archive/route';
import { PATCH as updateItem } from '../../../app/api/v1/templates/items/[id]/route';
import { POST as addItem } from '../../../app/api/v1/templates/items/route';
import { GET as getTemplates } from '../../../app/api/v1/templates/route';
import { useTestDb } from '../setup';

const db = useTestDb();

const request = (method: string, url: string, token?: string, body?: unknown) =>
  new Request(`https://nestwise.test${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { cookie: `nw_session=${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function signUp(email: string) {
  const response = await signup(request('POST', '/api/v1/auth/signup', undefined, { email, password: 'correct-horse' }));
  return /nw_session=([^;]*)/.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '';
}

type TemplatesBody = { monthly: { itemId: string; seedKey: string | null; groupId: string }[]; yearly: { itemId: string; seedKey: string | null }[]; totals: Record<string, number> };

async function adminWithPlan() {
  process.env.ALLOWED_SIGNUP_EMAILS = 'priya@example.com';
  const token = await signUp('priya@example.com');
  const created = await createFamily(
    request('POST', '/api/v1/families', token, { name: 'Our Family', currencyCode: 'INR', timeZone: 'Asia/Kolkata', openingPotMinor: 0 }),
  );
  const { family } = (await created.json()) as { family: { id: string } };
  await importPlan({ db: db(), familyId: family.id });
  const body = (await (await getTemplates(request('GET', '/api/v1/templates', token))).json()) as TemplatesBody;
  return { token, familyId: family.id, templates: body };
}

describe('/api/v1/templates', () => {
  it('401 without a session, 403 for someone with no family', async () => {
    expect((await getTemplates(request('GET', '/api/v1/templates'))).status).toBe(401);
    const stranger = await signUp('stranger@example.com');
    expect((await getTemplates(request('GET', '/api/v1/templates', stranger))).status).toBe(403);
  });

  it('returns the three templates with exact totals', async () => {
    const { templates } = await adminWithPlan();
    expect(templates.totals).toEqual({ monthly: 8_150_000, savings: 1_700_000, yearly: 44_300_000 });
    expect(templates.monthly).toHaveLength(20);
  });

  it('adds, edits, archives and reorders items; refuses a due month on a monthly item (422)', async () => {
    const { token, templates } = await adminWithPlan();
    const groceries = templates.monthly.find((m) => m.seedKey === 'groceries')!;

    const added = await addItem(request('POST', '/api/v1/templates/items', token, { groupId: groceries.groupId, name: 'Snacks', amountMinor: 200_000 }));
    expect(added.status).toBe(201);
    const { item } = (await added.json()) as { item: { id: string; name: string } };
    expect(item.name).toBe('Snacks');

    const bad = await updateItem(request('PATCH', `/api/v1/templates/items/${groceries.itemId}`, token, { template: { amountMinor: 1, dueMonth: 3 } }), params({ id: groceries.itemId }));
    expect(bad.status).toBe(422);

    const tour = templates.yearly.find((y) => y.seedKey === 'tour')!;
    const edited = await updateItem(request('PATCH', `/api/v1/templates/items/${tour.itemId}`, token, { template: { amountMinor: 5_000_000, dueMonth: 5 } }), params({ id: tour.itemId }));
    expect(edited.status).toBe(200);

    expect((await archive(request('POST', `/api/v1/templates/items/${item.id}/archive`, token), params({ id: item.id }))).status).toBe(200);
    const again = await updateItem(request('PATCH', `/api/v1/templates/items/${item.id}`, token, { name: 'x' }), params({ id: item.id }));
    expect(again.status).toBe(409);

    const foodIds = templates.monthly.filter((m) => m.groupId === groceries.groupId).map((m) => m.itemId);
    const ok = await reorder(request('POST', `/api/v1/templates/groups/${groceries.groupId}/order`, token, { itemIds: [...foodIds].reverse() }), params({ id: groceries.groupId }));
    expect(ok.status).toBe(200);
    const after = (await (await getTemplates(request('GET', '/api/v1/templates', token))).json()) as TemplatesBody;
    expect(after.monthly[0]!.seedKey).toBe('outside_food');
    expect(after.yearly.find((y) => y.seedKey === 'tour')).toMatchObject({ dueMonth: 5 });
  });

  it('a member cannot edit the plan (403); a malformed item id is 400; another family’s item is 404', async () => {
    const { token, templates } = await adminWithPlan();
    const invite = (await (await createInvite(request('POST', '/api/v1/invites', token, { role: 'member' }))).json()) as { token: string };
    const member = await signUp('kid@example.com');
    await acceptInvite(request('POST', `/api/v1/invites/${invite.token}/accept`, member, {}), params({ token: invite.token }));
    const groceries = templates.monthly.find((m) => m.seedKey === 'groceries')!;
    const asMember = await updateItem(request('PATCH', `/api/v1/templates/items/${groceries.itemId}`, member, { name: 'Food' }), params({ id: groceries.itemId }));
    expect(asMember.status).toBe(403);

    expect((await updateItem(request('PATCH', '/api/v1/templates/items/nope', token, { name: 'x' }), params({ id: 'nope' }))).status).toBe(400);

    process.env.ALLOWED_SIGNUP_EMAILS = 'other@example.com';
    const other = await signUp('other@example.com');
    await createFamily(request('POST', '/api/v1/families', other, { name: 'Other', currencyCode: 'INR', timeZone: 'Asia/Kolkata', openingPotMinor: 0 }));
    const foreign = await updateItem(request('PATCH', `/api/v1/templates/items/${groceries.itemId}`, other, { name: 'Mine' }), params({ id: groceries.itemId }));
    expect(foreign.status).toBe(404);
  });
});
