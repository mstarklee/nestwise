import { randomUUID } from 'node:crypto';
import { PotDepositAlreadyExistsError, SavingsAlreadyConfirmedError } from '@nestwise/domain/pot';
import type { IsoDate } from '@nestwise/domain/shared';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DrizzlePotGateway } from '@/adapters/pot/drizzle-pot-gateway';
import { DrizzlePotUnitOfWork } from '@/adapters/pot/drizzle-pot-unit-of-work';
import { makeConfirmPotDepositUseCase } from '@/composition/pot';
import { useTestDb } from '../../setup';
import { familyWithPlan } from '../../support/family-with-plan';

const db = useTestDb();
const NOV = { year: 2026, month: 11 };

async function insertTxn(familyId: string, userId: string, t: { kind?: 'expense' | 'refund'; status?: string; deleted?: boolean; amount: number; itemId: string }) {
  const id = randomUUID();
  await db().transaction(async (tx) => {
    await tx.execute(sql`insert into app.transactions
        (id, family_id, kind, amount_minor, currency_code, txn_date, entered_by, capture_method, status, entry_tz, deleted_at)
      values (${id}, ${familyId}, ${t.kind ?? 'expense'}, ${t.amount}, 'INR', '2026-11-07', ${userId}, 'typed',
              ${t.status ?? 'confirmed'}, 'Asia/Kolkata', ${t.deleted ? new Date().toISOString() : null})`);
    await tx.execute(sql`insert into app.allocations (id, transaction_id, family_id, item_id, plan_year, amount_minor)
      values (${randomUUID()}, ${id}, ${familyId}, ${t.itemId}, 2026, ${t.amount})`);
  });
}

const entry = (familyId: string, userId: string, kind: 'deposit' | 'extra_in' | 'taken_out', amountMinor: number) => ({
  id: randomUUID(),
  familyId,
  kind,
  amountMinor,
  entryDate: '2026-11-01' as IsoDate,
  period: NOV,
  note: kind === 'taken_out' ? 'Repair' : null,
  createdBy: userId,
  createdAt: new Date(),
});

describe('DrizzlePotGateway', () => {
  it('two concurrent deposits for the same month: exactly one succeeds, the other gets PotDepositAlreadyExistsError', async () => {
    const f = await familyWithPlan(db());
    const results = await Promise.allSettled([
      makeConfirmPotDepositUseCase(db()).execute({ actor: f.actor, period: NOV, amountMinor: 3_691_666 }),
      makeConfirmPotDepositUseCase(db()).execute({ actor: f.actor, period: NOV, amountMinor: 3_691_666 }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(PotDepositAlreadyExistsError);
    const { rows } = await db().execute(sql`select 1 from app.pot_entries where family_id = ${f.familyId} and kind = 'deposit'`);
    expect(rows).toHaveLength(1);
    const activity = await db().execute(sql`select 1 from app.activity where family_id = ${f.familyId} and action = 'pot.deposit'`);
    expect(activity.rows).toHaveLength(1);
  });

  it('the unit of work rolls back the deposit when the activity insert fails', async () => {
    const f = await familyWithPlan(db());
    await expect(
      new DrizzlePotUnitOfWork(db()).run(async ({ pot, activity }) => {
        await pot.saveEntry(entry(f.familyId, f.userId, 'deposit', 100));
        // No such family: the activity row's foreign key fails.
        await activity.record({ familyId: randomUUID(), actorId: f.userId, action: 'pot.deposit', entityType: 'pot_entry', entityId: 'x', before: null, after: null, at: new Date() });
      }),
    ).rejects.toThrow();
    expect(await new DrizzlePotGateway(db()).findDeposit(f.familyId, NOV)).toBeUndefined();
  });

  it('totals entries by kind (opening from setup included) and yearly spend, never another family’s', async () => {
    const f = await familyWithPlan(db());
    const other = await familyWithPlan(db());
    const pot = new DrizzlePotGateway(db());
    await pot.saveEntry(entry(f.familyId, f.userId, 'deposit', 3_691_666));
    await pot.saveEntry(entry(f.familyId, f.userId, 'extra_in', 1_000_000));
    await pot.saveEntry(entry(f.familyId, f.userId, 'taken_out', 200_000));
    await pot.saveEntry(entry(other.familyId, other.userId, 'extra_in', 777));

    await insertTxn(f.familyId, f.userId, { amount: 400_000, itemId: f.itemId('diwali_dress') });
    await insertTxn(f.familyId, f.userId, { amount: 50_000, itemId: f.itemId('diwali_dress'), kind: 'refund' });
    await insertTxn(f.familyId, f.userId, { amount: 90_000, itemId: f.itemId('diwali_dress'), status: 'pending' });
    await insertTxn(f.familyId, f.userId, { amount: 80_000, itemId: f.itemId('diwali_dress'), deleted: true });
    await insertTxn(f.familyId, f.userId, { amount: 94_500, itemId: f.itemId('groceries') }); // monthly: never from the pot
    await insertTxn(other.familyId, other.userId, { amount: 1_000, itemId: other.itemId('tour') });

    expect(await pot.entryTotals(f.familyId)).toEqual({ opening: 0, deposit: 3_691_666, extra_in: 1_000_000, taken_out: 200_000 });
    expect(await pot.yearlySpendMinor(f.familyId)).toBe(350_000);
    expect(await pot.findDeposit(other.familyId, NOV)).toBeUndefined();
    expect((await pot.findDeposit(f.familyId, NOV))!).toMatchObject({ amountMinor: 3_691_666, period: NOV, entryDate: '2026-11-01' });
  });

  it('savings: a second entry for the item and month is refused; skips: a repeat returns the first answer; both family-scoped', async () => {
    const f = await familyWithPlan(db());
    const other = await familyWithPlan(db());
    const pot = new DrizzlePotGateway(db());
    const savings = { id: randomUUID(), familyId: f.familyId, itemId: f.itemId('rd'), period: NOV, amountMinor: 200_000, createdBy: f.userId, createdAt: new Date() };
    await pot.saveSavings(savings);
    await expect(pot.saveSavings({ ...savings, id: randomUUID() })).rejects.toBeInstanceOf(SavingsAlreadyConfirmedError);
    expect(await pot.findSavings(f.familyId, f.itemId('rd'), NOV)).toMatchObject({ amountMinor: 200_000 });
    expect(await pot.listSavings(other.familyId, NOV)).toEqual([]);

    const skip = { id: randomUUID(), familyId: f.familyId, period: NOV, itemId: null, createdBy: f.userId, createdAt: new Date() };
    const [a, b] = await Promise.all([pot.saveSkip(skip), pot.saveSkip({ ...skip, id: randomUUID() })]);
    expect(a.id).toBe(b.id);
    expect(await pot.listSkips(f.familyId, NOV)).toHaveLength(1);
    expect(await pot.listSkips(other.familyId, NOV)).toEqual([]);
  });
});
