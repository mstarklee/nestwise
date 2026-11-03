import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidFamilyCommandError, UpdateFamilySettingsUseCase } from '../../src/family';
import { type Actor, NotAllowedError } from '../../src/shared';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryFamilyUnitOfWork } from '../fakes/in-memory-family-gateways';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const member: Actor = { userId: 'u2', familyId: 'f1', role: 'member' };

let uow: InMemoryFamilyUnitOfWork;
let update: UpdateFamilySettingsUseCase;

beforeEach(async () => {
  uow = new InMemoryFamilyUnitOfWork();
  await uow.families.save(familyRecord({ name: 'Our Family' }));
  update = new UpdateFamilySettingsUseCase(uow, uow.families, new FixedClock('2026-11-08T06:00:00Z'));
});

describe('UpdateFamilySettingsUseCase', () => {
  it('renaming the family changes nothing else (PRD §7 test 3)', async () => {
    const before = (await uow.families.findById('f1'))!;
    const after = await update.execute({ actor: admin, name: '  Kumar Family  ' });
    expect(after).toEqual({ ...before, name: 'Kumar Family' });
    expect(uow.activity.all().at(-1)).toMatchObject({ action: 'family.updated', before: { name: 'Our Family' }, after: { name: 'Kumar Family' } });
  });

  it('stores alert levels sorted and without repeats', async () => {
    expect((await update.execute({ actor: admin, alertThresholds: [100, 80, 80] })).alertThresholds).toEqual([80, 100]);
    expect((await update.execute({ actor: admin, alertThresholds: [90] })).alertThresholds).toEqual([90]);
  });

  it('refuses an empty name, levels outside 1–200, no levels or more than three, and a member', async () => {
    await expect(update.execute({ actor: admin, name: '   ' })).rejects.toBeInstanceOf(InvalidFamilyCommandError);
    await expect(update.execute({ actor: admin, name: 'x'.repeat(81) })).rejects.toBeInstanceOf(InvalidFamilyCommandError);
    await expect(update.execute({ actor: admin, alertThresholds: [0] })).rejects.toBeInstanceOf(InvalidFamilyCommandError);
    await expect(update.execute({ actor: admin, alertThresholds: [201] })).rejects.toBeInstanceOf(InvalidFamilyCommandError);
    await expect(update.execute({ actor: admin, alertThresholds: [] })).rejects.toBeInstanceOf(InvalidFamilyCommandError);
    await expect(update.execute({ actor: admin, alertThresholds: [50, 80, 100, 120] })).rejects.toBeInstanceOf(InvalidFamilyCommandError);
    await expect(update.execute({ actor: member, name: 'Ours' })).rejects.toBeInstanceOf(NotAllowedError);
    expect((await uow.families.findById('f1'))!.name).toBe('Our Family');
  });
});
