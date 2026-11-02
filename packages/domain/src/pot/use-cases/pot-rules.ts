import type { FamilyGateway } from '../../family';
import type { PlanGateway } from '../../plan';
import { type Clock, type IsoDate, type Period, todayIn } from '../../shared';
import { ChecklistItemNotFoundError, InvalidPotCommandError } from '../errors';

/** Internal checks and lookups shared by the pot use cases (not exported). */
export function assertPositiveAmount(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new InvalidPotCommandError('The amount must be more than zero, in whole minor units');
  }
}

export function assertPeriod(period: Period): void {
  if (!Number.isInteger(period.year) || !Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    throw new InvalidPotCommandError('Not a valid month');
  }
}

/** Today in the family's time zone. */
export async function familyToday(families: FamilyGateway, familyId: string, clock: Clock): Promise<IsoDate> {
  const family = await families.findById(familyId);
  if (!family) throw new InvalidPotCommandError('Your family was not found');
  return todayIn(family.timeZone, clock.now());
}

export async function assertSavingsItem(plan: PlanGateway, familyId: string, itemId: string): Promise<void> {
  const item = await plan.findItem(familyId, itemId);
  if (!item || item.archived || item.kind !== 'savings') throw new ChecklistItemNotFoundError('That item is not in the savings plan');
}
