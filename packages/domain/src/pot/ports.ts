import type { ActivityGateway, Period } from '../shared';
import type { ChecklistSkip, PotEntry, PotEntryKind, SavingsEntry } from './models';

/** Every method is scoped to one family. */
export interface PotGateway {
  /** Throws PotDepositAlreadyExistsError when the family already has a live deposit for that month. */
  saveEntry(entry: PotEntry): Promise<PotEntry>;
  findDeposit(familyId: string, period: Period): Promise<PotEntry | undefined>;
  /** Live (not deleted) entries summed per kind. */
  entryTotals(familyId: string): Promise<Readonly<Record<PotEntryKind, number>>>;
  /** Confirmed, live allocations to yearly items, refunds subtracted. */
  yearlySpendMinor(familyId: string): Promise<number>;
  findSavings(familyId: string, itemId: string, period: Period): Promise<SavingsEntry | undefined>;
  /** Throws SavingsAlreadyConfirmedError on a second entry for the same item and month. */
  saveSavings(entry: SavingsEntry): Promise<SavingsEntry>;
  listSavings(familyId: string, period: Period): Promise<readonly SavingsEntry[]>;
  listSkips(familyId: string, period: Period): Promise<readonly ChecklistSkip[]>;
  /** Saves the answer; if the same item was already skipped that month, returns the earlier answer. */
  saveSkip(skip: ChecklistSkip): Promise<ChecklistSkip>;
}

/** Pot writes plus their activity rows, all or nothing. */
export interface PotUnitOfWork {
  run<T>(work: (gateways: { pot: PotGateway; activity: ActivityGateway }) => Promise<T>): Promise<T>;
}
