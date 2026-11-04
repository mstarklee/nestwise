import { beforeEach, describe, expect, it } from 'vitest';
import { EnsureMiscellaneousItemUseCase, MISCELLANEOUS_NAME, MISCELLANEOUS_SEED_KEY } from '../../src/plan';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { SequentialIds } from '../fakes/sequential-ids';

const FAMILY = 'f1';
const ACTOR = 'u1';

describe('EnsureMiscellaneousItemUseCase', () => {
  let uow: InMemoryPlanUnitOfWork;
  let useCase: EnsureMiscellaneousItemUseCase;

  beforeEach(() => {
    uow = new InMemoryPlanUnitOfWork();
    useCase = new EnsureMiscellaneousItemUseCase(uow, uow.plan, new SequentialIds(), new FixedClock('2026-11-05T08:00:00Z'));
  });

  it('creates a monthly Miscellaneous item with a zero planned amount, in its own group', async () => {
    const { itemId } = await useCase.execute({ familyId: FAMILY, actorId: ACTOR });

    const item = await uow.plan.findItem(FAMILY, itemId);
    expect(item).toMatchObject({ name: MISCELLANEOUS_NAME, kind: 'monthly', archived: false, seedKey: MISCELLANEOUS_SEED_KEY });

    const group = await uow.plan.findGroup(FAMILY, item!.groupId);
    expect(group).toMatchObject({ name: MISCELLANEOUS_NAME, kind: 'monthly', archived: false });

    const line = await uow.plan.findTemplateLine(FAMILY, itemId);
    expect(line?.amountMinor).toBe(0);
  });

  it('returns the same item on a second call and creates nothing more', async () => {
    const first = await useCase.execute({ familyId: FAMILY, actorId: ACTOR });
    const before = uow.plan.counts();

    const second = await useCase.execute({ familyId: FAMILY, actorId: ACTOR });

    expect(second.itemId).toBe(first.itemId);
    expect(uow.plan.counts()).toEqual(before);
  });

  it('puts the item in the live item list, so the parse can match against it', async () => {
    const { itemId } = await useCase.execute({ familyId: FAMILY, actorId: ACTOR });

    const live = await uow.plan.listItems(FAMILY, { includeArchived: false });
    expect(live.map((i) => i.id)).toContain(itemId);
  });

  it('records one activity row for the creation and none for a repeat call', async () => {
    await useCase.execute({ familyId: FAMILY, actorId: ACTOR });
    const after = uow.activity.snapshot().length;
    await useCase.execute({ familyId: FAMILY, actorId: ACTOR });

    expect(after).toBe(1);
    expect(uow.activity.snapshot()).toHaveLength(1);
  });

  it('keeps one family\'s Miscellaneous out of another family\'s plan', async () => {
    const mine = await useCase.execute({ familyId: FAMILY, actorId: ACTOR });
    const theirs = await useCase.execute({ familyId: 'f2', actorId: 'u9' });

    expect(theirs.itemId).not.toBe(mine.itemId);
    expect((await uow.plan.listItems(FAMILY, { includeArchived: true })).map((i) => i.id)).toEqual([mine.itemId]);
  });

  it('brings an archived Miscellaneous back to life rather than making a second one', async () => {
    const { itemId } = await useCase.execute({ familyId: FAMILY, actorId: ACTOR });
    await uow.plan.saveItem({ ...(await uow.plan.findItem(FAMILY, itemId))!, archived: true });

    const again = await useCase.execute({ familyId: FAMILY, actorId: ACTOR });

    expect(again.itemId).toBe(itemId);
    expect((await uow.plan.findItem(FAMILY, itemId))?.archived).toBe(false);
    expect(await uow.plan.listItems(FAMILY, { includeArchived: true })).toHaveLength(1);
  });

  it('reuses an existing Miscellaneous group rather than making a second one', async () => {
    await uow.plan.saveGroup({ id: 'g-existing', familyId: FAMILY, kind: 'monthly', name: MISCELLANEOUS_NAME, sort: 0, archived: false });

    const { itemId } = await useCase.execute({ familyId: FAMILY, actorId: ACTOR });

    expect((await uow.plan.findItem(FAMILY, itemId))?.groupId).toBe('g-existing');
    expect(await uow.plan.listGroups(FAMILY)).toHaveLength(1);
  });
});
