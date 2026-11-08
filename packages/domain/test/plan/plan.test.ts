import { beforeEach, describe, expect, it } from 'vitest';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import {
  AddItemUseCase,
  ArchiveItemUseCase,
  GetTemplatesUseCase,
  ImportPlanUseCase,
  InvalidPlanCommandError,
  ItemArchivedError,
  ItemNotFoundError,
  PlanAlreadyImportedError,
  ReorderItemsUseCase,
  UpdateItemUseCase,
} from '../../src/plan';
import { type Actor, NotAllowedError } from '../../src/shared';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const member: Actor = { ...admin, role: 'member' };
const otherFamilyAdmin: Actor = { userId: 'u9', familyId: 'f9', role: 'admin' };

let uow: InMemoryPlanUnitOfWork;
let importPlan: ImportPlanUseCase;
let getTemplates: GetTemplatesUseCase;
let addItem: AddItemUseCase;
let updateItem: UpdateItemUseCase;
let archiveItem: ArchiveItemUseCase;
let reorder: ReorderItemsUseCase;

beforeEach(() => {
  uow = new InMemoryPlanUnitOfWork();
  const ids = new SequentialIds();
  const clock = new FixedClock('2026-11-01T04:00:00Z');
  importPlan = new ImportPlanUseCase(uow, uow.plan, ids, clock);
  getTemplates = new GetTemplatesUseCase(uow.plan);
  addItem = new AddItemUseCase(uow, uow.plan, ids, clock);
  updateItem = new UpdateItemUseCase(uow, uow.plan, clock);
  archiveItem = new ArchiveItemUseCase(uow, uow.plan, clock);
  reorder = new ReorderItemsUseCase(uow, uow.plan, clock);
});

describe('ImportPlanUseCase and GetTemplatesUseCase', () => {
  it('imports the sample plan: 3 kinds, totals 81,500 / 17,000 / 4,43,000', async () => {
    expect(await importPlan.execute({ actor: admin, plan: samplePlanImport })).toEqual({ groups: 18, items: 44 });
    const t = await getTemplates.execute({ actor: admin });
    expect(t.totals).toEqual({ monthly: 8_150_000, savings: 1_700_000, yearly: 44_300_000 });
    expect([t.monthly.length, t.savings.length, t.yearly.length]).toEqual([20, 2, 22]);
    expect(t.yearly.filter((l) => l.dueMonth !== null)).toHaveLength(9); // 8 dated + Pongal
    expect(t.yearly.find((l) => l.seedKey === 'deepavali')!.dueMonth).toBeNull();
    expect(t.yearly.find((l) => l.seedKey === 'pongal')!.dueMonth).toBe(1);
    expect(uow.activity.all()).toMatchObject([{ action: 'plan.imported', familyId: 'f1' }]);
  });

  it('keeps the template order: groups, then items, as imported', async () => {
    await importPlan.execute({ actor: admin, plan: samplePlanImport });
    const t = await getTemplates.execute({ actor: admin });
    expect(t.monthly.slice(0, 3).map((e) => e.seedKey)).toEqual(['groceries', 'fruits', 'vegetables']);
    expect(t.monthly.at(-1)!.seedKey).toBe('spouse');
    expect(t.monthly[0]!.groupName).toBe('Food & Dining');
  });

  it('gold savings keeps its 10,000–20,000 hint', async () => {
    await importPlan.execute({ actor: admin, plan: samplePlanImport });
    const gold = (await getTemplates.execute({ actor: admin })).savings.find((s) => s.seedKey === 'gold')!;
    expect(gold).toMatchObject({ amountMinor: 1_500_000, hintMinMinor: 1_000_000, hintMaxMinor: 2_000_000 });
  });

  it('refuses a second import (PlanAlreadyImportedError), and a member cannot import', async () => {
    await expect(importPlan.execute({ actor: member, plan: samplePlanImport })).rejects.toBeInstanceOf(NotAllowedError);
    await importPlan.execute({ actor: admin, plan: samplePlanImport });
    await expect(importPlan.execute({ actor: admin, plan: samplePlanImport })).rejects.toBeInstanceOf(PlanAlreadyImportedError);
    expect(uow.plan.counts()).toEqual({ groups: 18, items: 44, lines: 44 });
  });

  it('refuses a due month on a monthly item in an import, and saves nothing', async () => {
    const bad = {
      groups: [{ key: 'food', kind: 'monthly' as const, name: 'Food', items: [{ key: 'g', name: 'Groceries', amountMinor: 1, dueMonth: 3 }] }],
    };
    await expect(importPlan.execute({ actor: admin, plan: bad })).rejects.toBeInstanceOf(InvalidPlanCommandError);
    expect(uow.plan.counts()).toEqual({ groups: 0, items: 0, lines: 0 });
    expect(uow.activity.count()).toBe(0);
  });

  it('marks the family’s nine monthly bills (₹42,500) and nothing else', async () => {
    await importPlan.execute({ actor: admin, plan: samplePlanImport });
    const t = await getTemplates.execute({ actor: admin });
    const bills = t.monthly.filter((e) => e.isBill);
    expect(bills.map((e) => e.seedKey)).toEqual(['rent', 'electricity', 'internet', 'gas', 'housekeeping', 'football', 'books_cloud', 'ott', 'spouse']);
    expect(bills.reduce((sum, e) => sum + e.amountMinor, 0)).toBe(4_250_000);
    expect([...t.savings, ...t.yearly].some((e) => e.isBill)).toBe(false);
  });

  it('refuses a savings or yearly item marked as a bill in an import, and saves nothing', async () => {
    const bad = { groups: [{ key: 's', kind: 'savings' as const, name: 'Savings', items: [{ key: 'rd', name: 'RD', amountMinor: 1, isBill: true }] }] };
    await expect(importPlan.execute({ actor: admin, plan: bad })).rejects.toBeInstanceOf(InvalidPlanCommandError);
    expect(uow.plan.counts()).toEqual({ groups: 0, items: 0, lines: 0 });
  });

  it('templates are per family', async () => {
    await importPlan.execute({ actor: admin, plan: samplePlanImport });
    expect((await getTemplates.execute({ actor: otherFamilyAdmin })).totals).toEqual({ monthly: 0, savings: 0, yearly: 0 });
  });
});

describe('editing items', () => {
  beforeEach(async () => {
    await importPlan.execute({ actor: admin, plan: samplePlanImport });
  });

  const itemOf = async (seedKey: string) =>
    [...(await uow.plan.listItems('f1', { includeArchived: true }))].find((i) => i.seedKey === seedKey)!;

  it('adds an item at the end of its group, of the group kind, with its template line', async () => {
    const food = [...(await uow.plan.listGroups('f1'))].find((g) => g.name === 'Food & Dining')!;
    const item = await addItem.execute({ actor: admin, groupId: food.id, name: ' Snacks ', amountMinor: 200_000 });
    expect(item).toMatchObject({ familyId: 'f1', groupId: food.id, kind: 'monthly', name: 'Snacks', sort: 5, archived: false, seedKey: null, isBill: false });
    expect(await uow.plan.findTemplateLine('f1', item.id)).toMatchObject({ amountMinor: 200_000, dueMonth: null });
  });

  it('adds a monthly item as a bill, and refuses a bill in a yearly group', async () => {
    const groups = [...(await uow.plan.listGroups('f1'))];
    const kids = groups.find((g) => g.name === 'Kids & Childcare')!;
    expect(await addItem.execute({ actor: admin, groupId: kids.id, name: 'Swimming Fees', amountMinor: 150_000, isBill: true })).toMatchObject({ isBill: true });
    expect(await addItem.execute({ actor: admin, groupId: kids.id, name: 'Toys', amountMinor: 50_000 })).toMatchObject({ isBill: false });
    const before = uow.plan.counts();
    const insurance = groups.find((g) => g.kind === 'yearly')!;
    await expect(addItem.execute({ actor: admin, groupId: insurance.id, name: 'X', amountMinor: 1, isBill: true })).rejects.toBeInstanceOf(InvalidPlanCommandError);
    expect(uow.plan.counts()).toEqual(before);
  });

  it('switches the bill mark on and off; leaving it out keeps it; a yearly item cannot be a bill', async () => {
    const groceries = await itemOf('groceries');
    await updateItem.execute({ actor: admin, itemId: groceries.id, isBill: true });
    expect((await itemOf('groceries')).isBill).toBe(true);
    await updateItem.execute({ actor: admin, itemId: groceries.id, template: { amountMinor: 900_000 } });
    expect((await itemOf('groceries')).isBill).toBe(true);
    await updateItem.execute({ actor: admin, itemId: groceries.id, isBill: false });
    expect((await itemOf('groceries')).isBill).toBe(false);
    expect(uow.activity.all().at(-1)).toMatchObject({ action: 'item.updated', after: { item: { isBill: false } } });

    const tour = await itemOf('tour');
    await expect(updateItem.execute({ actor: admin, itemId: tour.id, isBill: true })).rejects.toBeInstanceOf(InvalidPlanCommandError);
    expect((await itemOf('tour')).isBill).toBe(false);
  });

  it('refuses a due month on a monthly item and saves nothing', async () => {
    const before = uow.plan.counts();
    const groceries = await itemOf('groceries');
    await expect(updateItem.execute({ actor: admin, itemId: groceries.id, template: { amountMinor: 800_000, dueMonth: 3 } })).rejects.toBeInstanceOf(
      InvalidPlanCommandError,
    );
    const food = [...(await uow.plan.listGroups('f1'))].find((g) => g.kind === 'monthly')!;
    await expect(addItem.execute({ actor: admin, groupId: food.id, name: 'X', amountMinor: 1, dueMonth: 3 })).rejects.toBeInstanceOf(
      InvalidPlanCommandError,
    );
    expect(uow.plan.counts()).toEqual(before);
    expect((await uow.plan.findTemplateLine('f1', groceries.id))!.dueMonth).toBeNull();
  });

  it('updates a yearly item schedule and amount; rejects month 13, a negative amount, a day without a month', async () => {
    const tour = await itemOf('tour');
    await updateItem.execute({ actor: admin, itemId: tour.id, name: 'Family tour', template: { amountMinor: 6_000_000, dueMonth: 5, dueDay: 10 } });
    expect(await uow.plan.findTemplateLine('f1', tour.id)).toMatchObject({ amountMinor: 6_000_000, dueMonth: 5, dueDay: 10 });
    expect((await itemOf('tour')).name).toBe('Family tour');
    for (const template of [{ amountMinor: 1, dueMonth: 13 }, { amountMinor: -1 }, { amountMinor: 1, dueMonth: null, dueDay: 4 }]) {
      await expect(updateItem.execute({ actor: admin, itemId: tour.id, template })).rejects.toBeInstanceOf(InvalidPlanCommandError);
    }
  });

  it('changing only the amount keeps the rest of the template line (hint range, due month and day)', async () => {
    const gold = await itemOf('gold');
    await updateItem.execute({ actor: admin, itemId: gold.id, template: { amountMinor: 1_800_000 } });
    expect(await uow.plan.findTemplateLine('f1', gold.id)).toMatchObject({ amountMinor: 1_800_000, hintMinMinor: 1_000_000, hintMaxMinor: 2_000_000 });
    const tour = await itemOf('tour');
    await updateItem.execute({ actor: admin, itemId: tour.id, template: { amountMinor: 5_000_000, dueMonth: 5, dueDay: 10 } });
    await updateItem.execute({ actor: admin, itemId: tour.id, template: { amountMinor: 5_500_000 } });
    expect(await uow.plan.findTemplateLine('f1', tour.id)).toMatchObject({ amountMinor: 5_500_000, dueMonth: 5, dueDay: 10 });
    // null still clears a field on purpose.
    await updateItem.execute({ actor: admin, itemId: tour.id, template: { amountMinor: 5_500_000, dueMonth: null, dueDay: null } });
    expect(await uow.plan.findTemplateLine('f1', tour.id)).toMatchObject({ dueMonth: null, dueDay: null });
  });

  it('a member cannot edit the plan (NotAllowedError)', async () => {
    const groceries = await itemOf('groceries');
    await expect(updateItem.execute({ actor: member, itemId: groceries.id, name: 'Food' })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(archiveItem.execute({ actor: member, itemId: groceries.id })).rejects.toBeInstanceOf(NotAllowedError);
  });

  it('an archived item cannot be edited and leaves the templates', async () => {
    const ott = await itemOf('ott');
    await archiveItem.execute({ actor: admin, itemId: ott.id });
    await expect(updateItem.execute({ actor: admin, itemId: ott.id, name: 'Streaming' })).rejects.toBeInstanceOf(ItemArchivedError);
    const t = await getTemplates.execute({ actor: admin });
    expect(t.monthly.some((e) => e.seedKey === 'ott')).toBe(false);
    expect(t.totals.monthly).toBe(8_050_000);
  });

  it("another family's item is not found", async () => {
    const groceries = await itemOf('groceries');
    await expect(updateItem.execute({ actor: otherFamilyAdmin, itemId: groceries.id, name: 'x' })).rejects.toBeInstanceOf(ItemNotFoundError);
  });

  it('reorders the live items of a group; the list must be exactly those items', async () => {
    const food = [...(await uow.plan.listGroups('f1'))].find((g) => g.name === 'Food & Dining')!;
    const foodItems = (await uow.plan.listItems('f1', { includeArchived: false })).filter((i) => i.groupId === food.id);
    const reversed = [...foodItems].sort((a, b) => b.sort - a.sort).map((i) => i.id);
    await reorder.execute({ actor: admin, groupId: food.id, itemIds: reversed });
    const t = await getTemplates.execute({ actor: admin });
    expect(t.monthly[0]!.seedKey).toBe('outside_food');
    await expect(reorder.execute({ actor: admin, groupId: food.id, itemIds: reversed.slice(1) })).rejects.toBeInstanceOf(
      InvalidPlanCommandError,
    );
  });
});
