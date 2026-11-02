import {
  type ChecklistSkip,
  PotDepositAlreadyExistsError,
  type PotEntry,
  type PotEntryKind,
  type PotGateway,
  type PotUnitOfWork,
  SavingsAlreadyConfirmedError,
  type SavingsEntry,
} from '../../src/pot';
import type { ActivityGateway, Period } from '../../src/shared';
import { FailingActivityGateway, InMemoryActivityGateway } from './in-memory-activity-gateway';

const samePeriod = (a: Period, b: Period) => a.year === b.year && a.month === b.month;

export class InMemoryPotGateway implements PotGateway {
  entries: PotEntry[] = [];
  savings: SavingsEntry[] = [];
  skips: ChecklistSkip[] = [];
  yearlySpend = new Map<string, number>();

  async saveEntry(entry: PotEntry) {
    // Like the partial unique index: one live deposit per family-month.
    if (entry.kind === 'deposit' && this.entries.some((e) => e.kind === 'deposit' && e.familyId === entry.familyId && samePeriod(e.period, entry.period))) {
      throw new PotDepositAlreadyExistsError('This month’s deposit is already confirmed');
    }
    this.entries.push(entry);
    return entry;
  }
  async findDeposit(familyId: string, period: Period) {
    return this.entries.find((e) => e.kind === 'deposit' && e.familyId === familyId && samePeriod(e.period, period));
  }
  async entryTotals(familyId: string) {
    const totals: Record<PotEntryKind, number> = { opening: 0, deposit: 0, extra_in: 0, taken_out: 0 };
    for (const e of this.entries) if (e.familyId === familyId) totals[e.kind] += e.amountMinor;
    return totals;
  }
  async yearlySpendMinor(familyId: string) {
    return this.yearlySpend.get(familyId) ?? 0;
  }
  async findSavings(familyId: string, itemId: string, period: Period) {
    return this.savings.find((s) => s.familyId === familyId && s.itemId === itemId && samePeriod(s.period, period));
  }
  async saveSavings(entry: SavingsEntry) {
    if (await this.findSavings(entry.familyId, entry.itemId, entry.period)) {
      throw new SavingsAlreadyConfirmedError('This savings item is already confirmed for the month');
    }
    this.savings.push(entry);
    return entry;
  }
  async listSavings(familyId: string, period: Period) {
    return this.savings.filter((s) => s.familyId === familyId && samePeriod(s.period, period));
  }
  async listSkips(familyId: string, period: Period) {
    return this.skips.filter((s) => s.familyId === familyId && samePeriod(s.period, period));
  }
  async saveSkip(skip: ChecklistSkip) {
    const existing = this.skips.find((s) => s.familyId === skip.familyId && s.itemId === skip.itemId && samePeriod(s.period, skip.period));
    if (existing) return existing;
    this.skips.push(skip);
    return skip;
  }
}

export class InMemoryPotUnitOfWork implements PotUnitOfWork {
  readonly activity = new InMemoryActivityGateway();
  failActivity = false;

  constructor(readonly pot: InMemoryPotGateway) {}

  async run<T>(work: (gateways: { pot: PotGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    const snapshot = { entries: [...this.pot.entries], savings: [...this.pot.savings], skips: [...this.pot.skips], activity: this.activity.snapshot() };
    try {
      return await work({ pot: this.pot, activity: new FailingActivityGateway(this.activity, () => this.failActivity) });
    } catch (error) {
      this.pot.entries = snapshot.entries;
      this.pot.savings = snapshot.savings;
      this.pot.skips = snapshot.skips;
      this.activity.restore(snapshot.activity);
      throw error;
    }
  }
}
