import { beforeEach, describe, expect, it } from 'vitest';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import { ApplyTemplateToMonthsUseCase, EnsureMonthBudgetUseCase, InvalidMonthCommandError, PreviewFutureMonthsUseCase } from '../../src/month-budget';
import { ImportPlanUseCase, UpdateItemUseCase } from '../../src/plan';
import { type Actor, NotAllowedError, type Period } from '../../src/shared';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryFamilyGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryMonthBudgetGateway, InMemoryMonthBudgetUnitOfWork } from '../fakes/in-memory-month-budget-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const member: Actor = { userId: 'u2', familyId: 'f1', role: 'member' };
const OCT: Period = { year: 2026, month: 10 };
const NOV: Period = { year: 2026, month: 11 };
const DEC: Period = { year: 2026, month: 12 };
const JAN: Period = { year: 2027, month: 1 };

let budgets: InMemoryMonthBudgetGateway;
let planUow: InMemoryPlanUnitOfWork;
let preview: PreviewFutureMonthsUseCase;
let apply: ApplyTemplateToMonthsUseCase;
let itemId: (seedKey: string) => string;
let clock: FixedClock;

const planned = async (period: Period, seedKey: string) => (await budgets.findByPeriod('f1', period))!.lines.find((l) => l.itemId === itemId(seedKey))!.plannedMinor;

beforeEach(async () => {
  planUow = new InMemoryPlanUnitOfWork();
  const ids = new SequentialIds();
  clock = new FixedClock('2026-11-08T06:00:00Z');
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, plan: samplePlanImport });
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  itemId = (seedKey) => items.find((i) => i.seedKey === seedKey)!.id;
  const families = new InMemoryFamilyGateway();
  await families.save(familyRecord());
  budgets = new InMemoryMonthBudgetGateway();
  const ensure = new EnsureMonthBudgetUseCase(budgets, planUow.plan, ids);
  // October and November exist; December and January were made early for planning.
  for (const period of [OCT, NOV, DEC, JAN]) await ensure.execute({ familyId: 'f1', period });
  preview = new PreviewFutureMonthsUseCase(budgets, families, clock);
  apply = new ApplyTemplateToMonthsUseCase(new InMemoryMonthBudgetUnitOfWork(budgets), budgets, planUow.plan, families, ids, clock);
});

describe('applying a template change to future months (PRD §6.2)', () => {
  it('the preview lists only months after this one that already exist', async () => {
    expect((await preview.execute({ actor: admin })).months).toEqual([DEC, JAN]);
  });

  it('applying the new Groceries amount to December changes December only (PRD §7 test 6)', async () => {
    await new UpdateItemUseCase(planUow, planUow.plan, clock).execute({ actor: admin, itemId: itemId('groceries'), template: { amountMinor: 900_000 } });
    await apply.execute({ actor: admin, itemId: itemId('groceries'), months: [DEC] });
    expect(await planned(DEC, 'groceries')).toBe(900_000);
    expect(await planned(JAN, 'groceries')).toBe(800_000);
    expect(await planned(NOV, 'groceries')).toBe(800_000);
  });

  it('refuses this month, a past month, a month that does not exist, a yearly item, and a member', async () => {
    const groceries = itemId('groceries');
    await expect(apply.execute({ actor: admin, itemId: groceries, months: [NOV] })).rejects.toBeInstanceOf(InvalidMonthCommandError);
    await expect(apply.execute({ actor: admin, itemId: groceries, months: [OCT] })).rejects.toBeInstanceOf(InvalidMonthCommandError);
    await expect(apply.execute({ actor: admin, itemId: groceries, months: [{ year: 2027, month: 3 }] })).rejects.toBeInstanceOf(InvalidMonthCommandError);
    await expect(apply.execute({ actor: admin, itemId: itemId('tour'), months: [DEC] })).rejects.toThrow();
    await expect(apply.execute({ actor: member, itemId: groceries, months: [DEC] })).rejects.toBeInstanceOf(NotAllowedError);
    expect(await planned(DEC, 'groceries')).toBe(800_000);
  });
});
