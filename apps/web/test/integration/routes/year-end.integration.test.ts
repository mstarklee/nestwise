import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { POST as record } from '../../../app/api/v1/transactions/route';
import { PUT as setAmount } from '../../../app/api/v1/years/[y]/lines/[id]/amount/route';
import { GET as getNextReview, POST as confirmNextReview } from '../../../app/api/v1/years/[y]/next-year-review/route';
import { POST as answerLine } from '../../../app/api/v1/years/[y]/year-end/lines/[id]/route';
import { GET as getYearEnd } from '../../../app/api/v1/years/[y]/year-end/route';
import { GET as getYear } from '../../../app/api/v1/years/[y]/route';
import { makeEnsureYearPlanUseCase } from '@/composition/year-plan';
import { useTestDb } from '../setup';
import { adminWithPlan, params, request } from '../support/api';

const db = useTestDb();

type YearEndBody = { year: number; lines: { id: string; name: string; remainingMinor: number }[] };

const yearEnd = async (token: string) => (await (await getYearEnd(request('GET', '/api/v1/years/2026/year-end', token), params({ y: '2026' }))).json()) as YearEndBody;
const answer = (token: string, lineId: string, body: unknown) =>
  answerLine(request('POST', `/api/v1/years/2026/year-end/lines/${lineId}`, token, body), params({ y: '2026', id: lineId }));

async function familyWith2026() {
  const family = await adminWithPlan(db());
  await makeEnsureYearPlanUseCase(db()).execute({ familyId: family.familyId, year: 2026 });
  return family;
}

describe('/api/v1/years/{y}/year-end', () => {
  it('lists open 2026 lines; carry is 200 and the line leaves the list; a second answer is 409; a member gets 403; another family gets 404', async () => {
    const { token, join } = await familyWith2026();
    const before = await yearEnd(token);
    const tour = before.lines.find((l) => l.name === 'Family Tour / Vacation')!;
    expect(tour.remainingMinor).toBe(5_000_000);
    expect((await answer(await join('member'), tour.id, { kind: 'drop' })).status).toBe(403);
    const stranger = await adminWithPlan(db());
    expect((await answer(stranger.token, tour.id, { kind: 'drop' })).status).toBe(404);
    expect((await answer(token, tour.id, { kind: 'carry', dueMonth: 3 })).status).toBe(200);
    expect((await yearEnd(token)).lines.map((l) => l.id)).not.toContain(tour.id);
    expect((await answer(token, tour.id, { kind: 'done' })).status).toBe(409);
    expect((await answer(token, tour.id, { kind: 'maybe' })).status).toBe(400);
  });

  it('a 2027 payment with plan year 2026 reduces the carried line’s remaining', async () => {
    const { token, itemId } = await familyWith2026();
    const service = (await yearEnd(token)).lines.find((l) => l.name === 'Car & Bike Servicing')!;
    await answer(token, service.id, { kind: 'carry', dueMonth: null });
    const groceriesFree = { id: randomUUID(), amountMinor: 400_000, txnDate: '2027-02-10', allocations: [{ itemId: itemId('car_bike_service'), amountMinor: 400_000, planYear: 2026 }] };
    expect((await record(request('POST', '/api/v1/transactions', token, groceriesFree))).status).toBe(201);
    const year = (await (await getYear(request('GET', '/api/v1/years/2026', token), params({ y: '2026' }))).json()) as { lines: { id: string; remainingMinor: number }[] };
    expect(year.lines.find((l) => l.id === service.id)!.remainingMinor).toBe(1_100_000);
  });
});

describe('/api/v1/years/{y}/next-year-review and line amounts', () => {
  it('shows 2027 unconfirmed, then confirmed after "Looks right"; an Admin can change a 2027 amount', async () => {
    const { token, familyId, join } = await familyWith2026();
    const plan = await makeEnsureYearPlanUseCase(db()).execute({ familyId, year: 2027 });
    const get = async () => (await (await getNextReview(request('GET', '/api/v1/years/2027/next-year-review', token), params({ y: '2027' }))).json()) as { confirmed: boolean; lines: unknown[] };
    expect(await get()).toMatchObject({ confirmed: false });
    expect((await get()).lines).toHaveLength(22);
    expect((await confirmNextReview(request('POST', '/api/v1/years/2027/next-year-review', await join('member')), params({ y: '2027' }))).status).toBe(403);
    expect((await confirmNextReview(request('POST', '/api/v1/years/2027/next-year-review', token), params({ y: '2027' }))).status).toBe(204);
    expect((await get()).confirmed).toBe(true);
    const tour = plan.lines.find((l) => l.name === 'Family Tour / Vacation')!;
    const changed = await setAmount(request('PUT', `/api/v1/years/2027/lines/${tour.id}/amount`, token, { plannedMinor: 6_000_000 }), params({ y: '2027', id: tour.id }));
    expect(changed.status).toBe(200);
    expect(((await changed.json()) as { line: { plannedMinor: number } }).line.plannedMinor).toBe(6_000_000);
  });
});
