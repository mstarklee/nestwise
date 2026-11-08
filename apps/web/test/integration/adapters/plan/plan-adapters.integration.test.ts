import { describe, expect, it } from 'vitest';
import { importPlan } from '../../../../../../scripts/import-plan';
import { DrizzleUserGateway } from '@/adapters/auth/drizzle-user-gateway';
import { DrizzlePlanGateway } from '@/adapters/plan/drizzle-plan-gateway';
import { makeCreateFamilyUseCase } from '@/composition/family';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { useTestDb } from '../../setup';

const db = useTestDb();

async function familyFor(userId: string, email: string): Promise<string> {
  await new DrizzleUserGateway(db()).save({ id: userId, email, passwordHash: 'x', emailVerifiedAt: null, googleSubject: null, createdAt: new Date() });
  const family = await makeCreateFamilyUseCase(db()).execute({
    actorUserId: userId,
    name: 'Family',
    currencyCode: 'INR',
    timeZone: 'Asia/Kolkata',
    openingPotMinor: 0,
    signupAllowed: true,
  });
  return family.id;
}

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

describe('plan adapters and import script', () => {
  it('scripts/import-plan loads the sample plan: 20 monthly, 2 savings, 22 yearly items, totals exact', async () => {
    const familyId = await familyFor(A, 'priya@example.com');
    expect(await importPlan({ db: db(), familyId })).toEqual({ groups: 18, items: 44 });
    const t = await makeGetTemplatesUseCase(db()).execute({ actor: { userId: A, familyId, role: 'admin' } });
    expect([t.monthly.length, t.savings.length, t.yearly.length]).toEqual([20, 2, 22]);
    expect(t.totals).toEqual({ monthly: 8_150_000, savings: 1_700_000, yearly: 44_300_000 });
    expect(t.savings.find((s) => s.seedKey === 'gold')).toMatchObject({ hintMinMinor: 1_000_000, hintMaxMinor: 2_000_000 });
    expect(t.yearly.find((y) => y.seedKey === 'school_t1')).toMatchObject({ dueMonth: 5, dueDay: null });
    expect(t.monthly.filter((m) => m.isBill).map((m) => m.seedKey)).toEqual(['rent', 'electricity', 'internet', 'gas', 'housekeeping', 'football', 'books_cloud', 'ott', 'spouse']);
  });

  it('refuses to import twice', async () => {
    const familyId = await familyFor(A, 'priya@example.com');
    await importPlan({ db: db(), familyId });
    await expect(importPlan({ db: db(), familyId })).rejects.toThrow(/already has a plan/);
  });

  it("never returns another family's groups, items or template lines", async () => {
    const familyA = await familyFor(A, 'priya@example.com');
    const familyB = await familyFor(B, 'other@example.com');
    await importPlan({ db: db(), familyId: familyA });
    const plan = new DrizzlePlanGateway(db());
    const itemOfA = (await plan.listItems(familyA, { includeArchived: false }))[0]!;

    expect(await plan.listGroups(familyB)).toEqual([]);
    expect(await plan.listItems(familyB, { includeArchived: true })).toEqual([]);
    expect(await plan.listTemplateLines(familyB)).toEqual([]);
    expect(await plan.findItem(familyB, itemOfA.id)).toBeUndefined();
    expect(await plan.findTemplateLine(familyB, itemOfA.id)).toBeUndefined();
    expect(await plan.findGroup(familyB, itemOfA.groupId)).toBeUndefined();
    expect(await plan.findItem(familyA, itemOfA.id)).toEqual(itemOfA);
  });

  it('updates an item and its template line in place (upsert)', async () => {
    const familyId = await familyFor(A, 'priya@example.com');
    await importPlan({ db: db(), familyId });
    const plan = new DrizzlePlanGateway(db());
    const item = (await plan.listItems(familyId, { includeArchived: false })).find((i) => i.seedKey === 'tour')!;
    await plan.saveItem({ ...item, name: 'Family tour', archived: true });
    await plan.saveTemplateLine(familyId, { itemId: item.id, amountMinor: 6_000_000, dueMonth: 5, dueDay: 10, hintMinMinor: null, hintMaxMinor: null });
    expect(await plan.findItem(familyId, item.id)).toMatchObject({ name: 'Family tour', archived: true });
    expect(await plan.findTemplateLine(familyId, item.id)).toMatchObject({ amountMinor: 6_000_000, dueMonth: 5, dueDay: 10 });
    expect((await plan.listItems(familyId, { includeArchived: false })).some((i) => i.id === item.id)).toBe(false);
  });

  it('saves and reads the bill mark; the database refuses it on a yearly item', async () => {
    const familyId = await familyFor(A, 'priya@example.com');
    await importPlan({ db: db(), familyId });
    const plan = new DrizzlePlanGateway(db());
    const items = await plan.listItems(familyId, { includeArchived: false });
    const groceries = items.find((i) => i.seedKey === 'groceries')!;
    expect(groceries.isBill).toBe(false);
    await plan.saveItem({ ...groceries, isBill: true });
    expect(await plan.findItem(familyId, groceries.id)).toMatchObject({ isBill: true });
    const tour = items.find((i) => i.seedKey === 'tour')!;
    await expect(plan.saveItem({ ...tour, isBill: true })).rejects.toThrow();
    expect(await plan.findItem(familyId, tour.id)).toMatchObject({ isBill: false });
  });
});
