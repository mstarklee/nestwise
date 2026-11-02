import { describe, expect, it } from 'vitest';
import { POST as cancel } from '../../../app/api/v1/years/[y]/lines/[id]/cancel/route';
import { POST as done } from '../../../app/api/v1/years/[y]/lines/[id]/done/route';
import { PUT as schedule } from '../../../app/api/v1/years/[y]/lines/[id]/schedule/route';
import { POST as firstYearCheck } from '../../../app/api/v1/years/[y]/first-year-check/route';
import { GET as getYear } from '../../../app/api/v1/years/[y]/route';
import { useTestDb } from '../setup';
import { adminWithPlan, params, request } from '../support/api';

const db = useTestDb();

type YearBody = {
  year: number;
  firstYearCheckDone: boolean;
  totalMinor: number;
  undatedRemainingMinor: number;
  lines: { id: string; itemId: string; state: string; status: string; dueMonth: number | null; remainingMinor: number }[];
};

const year = async (token: string, y = '2026') => {
  const response = await getYear(request('GET', `/api/v1/years/${y}`, token), params({ y }));
  return { status: response.status, body: (await response.json()) as YearBody };
};

describe('/api/v1/years/[y]', () => {
  it('returns the current year (created on first use) with exact totals; 401, 400 and 404 where due', async () => {
    const { token } = await adminWithPlan(db());
    expect((await getYear(request('GET', '/api/v1/years/2026'), params({ y: '2026' }))).status).toBe(401);
    const { status, body } = await year(token);
    expect(status).toBe(200);
    expect(body).toMatchObject({ year: 2026, firstYearCheckDone: false, totalMinor: 44_300_000 });
    expect(body.lines).toHaveLength(22);
    expect((await year(token, '26')).status).toBe(400);
    expect((await year(token, '2027')).status).toBe(404);
  });

  it('first-year check runs once (200, then 409) and leaves only ticked lines open', async () => {
    const { token, itemId } = await adminWithPlan(db());
    const { body } = await year(token);
    const lineOf = (key: string) => body.lines.find((l) => l.itemId === itemId(key))!.id;
    const ticked = [lineOf('deepavali'), lineOf('bike_ins')];
    const answer = () =>
      firstYearCheck(request('POST', '/api/v1/years/2026/first-year-check', token, { stillToComeLineIds: ticked, setupMonth: '2026-11' }), params({ y: '2026' }));
    expect((await answer()).status).toBe(200);
    expect((await answer()).status).toBe(409);
    const after = (await year(token)).body;
    expect(after.firstYearCheckDone).toBe(true);
    expect(after.lines.filter((l) => l.state === 'open').map((l) => l.id).sort()).toEqual([...ticked].sort());
    expect(after.undatedRemainingMinor).toBe(500_000);
  });

  it('schedules, marks done and cancels lines; a bad month is 422, a member is 403, a bad id is 400', async () => {
    const { token, itemId, join } = await adminWithPlan(db());
    const lines = (await year(token)).body.lines;
    const tour = lines.find((l) => l.itemId === itemId('tour'))!.id;
    const pongal = lines.find((l) => l.itemId === itemId('pongal'))!.id;
    const at = (path: string, id: string) => `/api/v1/years/2026/lines/${id}/${path}`;

    const put = (id: string, body: unknown, who = token) => schedule(request('PUT', at('schedule', id), who, body), params({ y: '2026', id }));
    const ok = await put(tour, { dueMonth: 5, dueDay: 20 });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { line: { dueMonth: number } }).line.dueMonth).toBe(5);
    expect((await put(tour, { dueMonth: 13, dueDay: null })).status).toBe(422);
    expect((await put('nope', { dueMonth: 5, dueDay: null })).status).toBe(400);
    const member = await join('member');
    expect((await put(tour, { dueMonth: 6, dueDay: null }, member)).status).toBe(403);

    expect((await done(request('POST', at('done', pongal), token), params({ y: '2026', id: pongal }))).status).toBe(200);
    expect((await cancel(request('POST', at('cancel', pongal), token), params({ y: '2026', id: pongal }))).status).toBe(409);
    expect((await cancel(request('POST', at('cancel', tour), token), params({ y: '2026', id: tour }))).status).toBe(200);

    const after = (await year(token)).body;
    expect(after.lines.find((l) => l.id === tour)).toMatchObject({ state: 'cancelled', dueMonth: 5, status: 'cancelled' });
    expect(after.lines.find((l) => l.id === pongal)).toMatchObject({ state: 'done', status: 'paid', remainingMinor: 0 });
    expect(after.totalMinor).toBe(44_300_000 - 5_000_000);
  });
});
