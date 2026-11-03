import { describe, expect, it } from 'vitest';
import { GET as getMonth } from '../../../app/api/v1/months/[ym]/route';
import { PATCH as updateItem } from '../../../app/api/v1/templates/items/[id]/route';
import { makeEnsureMonthBudgetUseCase } from '@/composition/month-budget';
import { useTestDb } from '../setup';
import { adminWithPlan, params, request } from '../support/api';

const db = useTestDb();

describe('PATCH /api/v1/templates/items/{id} with applyToMonths', () => {
  it('applies a new Groceries amount to December only; this month is refused (422) and nothing changes', async () => {
    const { token, familyId, itemId } = await adminWithPlan(db());
    const ensure = makeEnsureMonthBudgetUseCase(db());
    // Integration tests run on the real clock; these are months after it.
    const now = new Date();
    const later = (n: number) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    };
    const ym = (p: { year: number; month: number }) => `${p.year}-${String(p.month).padStart(2, '0')}`;
    for (const p of [later(0), later(1), later(2)]) await ensure.execute({ familyId, period: p });
    const groceries = itemId('groceries');
    const planned = async (p: { year: number; month: number }) => {
      const body = (await (await getMonth(request('GET', `/api/v1/months/${ym(p)}`, token), params({ ym: ym(p) }))).json()) as { lines: { itemId: string; plannedMinor: number }[] };
      return body.lines.find((l) => l.itemId === groceries)!.plannedMinor;
    };
    const patch = (body: unknown) => updateItem(request('PATCH', `/api/v1/templates/items/${groceries}`, token, body), params({ id: groceries }));

    expect((await patch({ template: { amountMinor: 900_000 }, applyToMonths: [ym(later(0))] })).status).toBe(422);
    expect(await planned(later(1))).toBe(800_000);
    expect((await patch({ template: { amountMinor: 900_000 }, applyToMonths: [ym(later(1))] })).status).toBe(200);
    expect(await planned(later(1))).toBe(900_000);
    expect(await planned(later(2))).toBe(800_000);
    expect(await planned(later(0))).toBe(800_000);
  });
});
