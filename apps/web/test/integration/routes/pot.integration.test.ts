import { describe, expect, it } from 'vitest';
import { GET as getChecklist } from '../../../app/api/v1/pot/checklist/[ym]/route';
import { POST as deposit } from '../../../app/api/v1/pot/deposits/route';
import { POST as movement } from '../../../app/api/v1/pot/movements/route';
import { GET as getPot } from '../../../app/api/v1/pot/route';
import { POST as savings } from '../../../app/api/v1/pot/savings/route';
import { POST as skip } from '../../../app/api/v1/pot/skips/route';
import { useTestDb } from '../setup';
import { adminWithPlan, params, request } from '../support/api';

const db = useTestDb();

type ChecklistBody = { pot: { suggestedMinor: number; status: string; confirmedMinor: number | null }; savings: { itemId: string; status: string }[] };

const checklistOf = async (token: string, ym = '2026-11') =>
  (await (await getChecklist(request('GET', `/api/v1/pot/checklist/${ym}`, token), params({ ym }))).json()) as ChecklistBody;
const balanceOf = async (token: string) => ((await (await getPot(request('GET', '/api/v1/pot', token))).json()) as { balanceMinor: number }).balanceMinor;

describe('/api/v1/pot', () => {
  it('deposit 201 then 409; checklist shows it done; balance counts it', async () => {
    const { token } = await adminWithPlan(db());
    expect((await getPot(request('GET', '/api/v1/pot'))).status).toBe(401);
    expect(await balanceOf(token)).toBe(0);

    const nov = await checklistOf(token);
    expect(nov.pot).toMatchObject({ suggestedMinor: 3_691_666, status: 'pending' });
    const post = () => deposit(request('POST', '/api/v1/pot/deposits', token, { period: '2026-11', amountMinor: nov.pot.suggestedMinor }));
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(409);
    expect((await checklistOf(token)).pot).toMatchObject({ status: 'done', confirmedMinor: 3_691_666 });
    expect(await balanceOf(token)).toBe(3_691_666);
  });

  it('savings, skips and pot movements; a taken-out with no note is 422, a viewer is 403, a bad month is 400', async () => {
    const { token, itemId, join } = await adminWithPlan(db());
    expect((await savings(request('POST', '/api/v1/pot/savings', token, { period: '2026-11', itemId: itemId('rd'), amountMinor: 250_000 }))).status).toBe(201);
    expect((await skip(request('POST', '/api/v1/pot/skips', token, { period: '2026-11', itemId: itemId('gold') }))).status).toBe(201);
    expect((await skip(request('POST', '/api/v1/pot/skips', token, { period: '2026-11', itemId: null }))).status).toBe(201);
    const nov = await checklistOf(token);
    expect(nov.pot.status).toBe('skipped');
    expect(nov.savings.map((s) => s.status)).toEqual(['done', 'skipped']);

    expect((await movement(request('POST', '/api/v1/pot/movements', token, { kind: 'extra_in', amountMinor: 1_000_000, note: 'Bonus' }))).status).toBe(201);
    expect((await movement(request('POST', '/api/v1/pot/movements', token, { kind: 'taken_out', amountMinor: 1, note: ' ' }))).status).toBe(422);
    expect((await movement(request('POST', '/api/v1/pot/movements', token, { kind: 'taken_out', amountMinor: 200_000, note: 'Car repair' }))).status).toBe(201);
    expect(await balanceOf(token)).toBe(800_000);

    const viewer = await join('viewer');
    expect((await deposit(request('POST', '/api/v1/pot/deposits', viewer, { period: '2026-12', amountMinor: 1 }))).status).toBe(403);
    expect(await balanceOf(viewer)).toBe(800_000);
    expect((await getChecklist(request('GET', '/api/v1/pot/checklist/2026-13', token), params({ ym: '2026-13' }))).status).toBe(400);
  });
});
