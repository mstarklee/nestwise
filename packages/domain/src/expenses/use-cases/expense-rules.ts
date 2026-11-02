import type { MembershipGateway } from '../../family';
import type { PlanGateway } from '../../plan';
import { type IsoDate, sumMinor, toIsoDate } from '../../shared';
import { ExpenseItemNotFoundError, InvalidExpenseCommandError, ItemNotUsableError } from '../errors';
import type { Allocation, AllocationInput } from '../models';

/** Internal rules shared by recording and editing an expense (not exported). */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 200;

export function assertClientId(id: string): void {
  if (!UUID.test(id)) throw new InvalidExpenseCommandError('The expense id must be a UUID made on the device');
}

export function checkDate(value: string): IsoDate {
  try {
    return toIsoDate(value);
  } catch (error) {
    throw new InvalidExpenseCommandError(`Not a real calendar date: "${value}"`, { cause: error });
  }
}

export function checkText(value: string | null | undefined, what: string): string | null {
  const text = value?.trim() || null;
  if (text !== null && [...text].length > MAX_TEXT) throw new InvalidExpenseCommandError(`The ${what} must be at most ${MAX_TEXT} characters`);
  return text;
}

/** Amount > 0; one or more parts, each > 0, on different items, adding up exactly to the amount. */
export function checkAmounts(amountMinor: number, allocations: readonly AllocationInput[]): void {
  const positive = (n: number) => Number.isSafeInteger(n) && n > 0;
  if (!positive(amountMinor)) throw new InvalidExpenseCommandError('The amount must be more than zero, in whole minor units');
  if (allocations.length === 0) throw new InvalidExpenseCommandError('Choose at least one item');
  if (!allocations.every((a) => positive(a.amountMinor))) throw new InvalidExpenseCommandError('Each part must be more than zero');
  if (new Set(allocations.map((a) => a.itemId)).size !== allocations.length) throw new InvalidExpenseCommandError('Each item can appear once');
  if (sumMinor(allocations.map((a) => a.amountMinor)) !== amountMinor) throw new InvalidExpenseCommandError('The parts must add up to the amount');
}

/** Each item must be a live monthly or yearly item of the family; yearly parts get a plan year (default: the date's year). */
export async function resolveAllocations(
  plan: PlanGateway,
  familyId: string,
  allocations: readonly AllocationInput[],
  txnDate: IsoDate,
): Promise<readonly Allocation[]> {
  const resolved: Allocation[] = [];
  for (const a of allocations) {
    const item = await plan.findItem(familyId, a.itemId);
    if (!item) throw new ExpenseItemNotFoundError('That item is not in your plan');
    if (item.archived) throw new ItemNotUsableError(`“${item.name}” is archived`);
    if (item.kind === 'savings') throw new ItemNotUsableError('Savings are confirmed in the monthly checklist, not spent');
    let planYear: number | null = null;
    if (item.kind === 'yearly') {
      planYear = a.planYear ?? Number(txnDate.slice(0, 4));
      if (!Number.isInteger(planYear) || planYear < 2000 || planYear > 2200) throw new InvalidExpenseCommandError('Not a valid plan year');
    }
    resolved.push({ itemId: a.itemId, amountMinor: a.amountMinor, planYear });
  }
  return resolved;
}

export async function assertPayer(memberships: MembershipGateway, familyId: string, paidBy: string | null): Promise<void> {
  if (paidBy === null) return;
  const membership = await memberships.findActive(paidBy);
  if (membership?.familyId !== familyId) throw new InvalidExpenseCommandError('Paid by must be a member of your family');
}
