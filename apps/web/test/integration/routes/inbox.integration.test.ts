import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { POST as resolve } from '../../../app/api/v1/duplicates/[id]/resolve/route';
import { GET as getInbox } from '../../../app/api/v1/inbox/route';
import { GET as getMonth } from '../../../app/api/v1/months/[ym]/route';
import { POST as record } from '../../../app/api/v1/transactions/route';
import { useTestDb } from '../setup';
import { adminWithPlan, params, request } from '../support/api';

const db = useTestDb();

type InboxBody = { entries: { matchId: string; pending: { id: string }; other: { id: string }; reasons: string[] }[] };

const post = (token: string, body: unknown) => record(request('POST', '/api/v1/transactions', token, body));
const inbox = async (token: string) => (await (await getInbox(request('GET', '/api/v1/inbox', token))).json()) as InboxBody;
const answer = (token: string | undefined, matchId: string, body: unknown) =>
  resolve(request('POST', `/api/v1/duplicates/${matchId}/resolve`, token, body), params({ id: matchId }));
const groceriesActual = async (token: string, groceries: string) => {
  const body = (await (await getMonth(request('GET', '/api/v1/months/2026-10', token), params({ ym: '2026-10' }))).json()) as {
    lines: { itemId: string; actualMinor: number }[];
  };
  return body.lines.find((l) => l.itemId === groceries)!.actualMinor;
};

async function spouseRepeats() {
  const family = await adminWithPlan(db());
  const spouse = await family.join('member');
  const groceries = family.itemId('groceries');
  const spend = (id: string) => ({ id, amountMinor: 94_500, txnDate: '2026-10-07', allocations: [{ itemId: groceries, amountMinor: 94_500 }] });
  const first = randomUUID();
  const second = randomUUID();
  expect((await post(family.token, spend(first))).status).toBe(201);
  const response = await post(spouse, spend(second));
  return { ...family, spouse, groceries, first, second, response };
}

describe('duplicate checks and the Inbox', () => {
  it('a spouse repeating ₹945 gets a pending question; it does not count until answered', async () => {
    const { token, groceries, first, second, response } = await spouseRepeats();
    expect(response.status).toBe(201);
    const body = (await response.json()) as { transaction: { status: string }; duplicate: { matchId: string; other: { id: string } } };
    expect(body.transaction.status).toBe('pending');
    expect(body.duplicate.other.id).toBe(first);
    expect((await inbox(token)).entries).toMatchObject([{ matchId: body.duplicate.matchId, pending: { id: second }, other: { id: first }, reasons: ['other_person'] }]);
    expect(await groceriesActual(token, groceries)).toBe(94_500);
  });

  it('Same: 204, counted once, merged row kept, and a second answer is 409', async () => {
    const { token, spouse, groceries, second } = await spouseRepeats();
    const [entry] = (await inbox(token)).entries;
    expect((await answer(spouse, entry!.matchId, { answer: 'same' })).status).toBe(204);
    expect(await groceriesActual(token, groceries)).toBe(94_500);
    expect((await inbox(token)).entries).toEqual([]);
    expect((await answer(token, entry!.matchId, { answer: 'different' })).status).toBe(409);
    // The merged expense is kept as a row (and as proof), never deleted.
    const { rows } = await db().execute<{ merged_into: string | null }>(sql`select merged_into from app.transactions where id = ${second}`);
    expect(rows[0]!.merged_into).not.toBeNull();
  });

  it('Different: both count', async () => {
    const { token, groceries } = await spouseRepeats();
    const [entry] = (await inbox(token)).entries;
    expect((await answer(token, entry!.matchId, { answer: 'different' })).status).toBe(204);
    expect(await groceriesActual(token, groceries)).toBe(189_000);
  });

  it('401 signed out, 404 for another family, 400 for a bad answer', async () => {
    const { token } = await spouseRepeats();
    const [entry] = (await inbox(token)).entries;
    const stranger = await adminWithPlan(db());
    expect((await answer(undefined, entry!.matchId, { answer: 'same' })).status).toBe(401);
    expect((await getInbox(request('GET', '/api/v1/inbox', undefined))).status).toBe(401);
    expect((await answer(stranger.token, entry!.matchId, { answer: 'same' })).status).toBe(404);
    expect((await inbox(stranger.token)).entries).toEqual([]);
    expect((await answer(token, entry!.matchId, { answer: 'maybe' })).status).toBe(400);
  });
});
