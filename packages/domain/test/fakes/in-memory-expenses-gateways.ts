import type { ExpenseFilter, ExpensesUnitOfWork, Transaction, TransactionGateway } from '../../src/expenses';
import type { ActualsGateway } from '../../src/month-budget';
import type { ActivityGateway, Period } from '../../src/shared';
import type { YearPaidGateway } from '../../src/year-plan';
import { FailingActivityGateway, InMemoryActivityGateway } from './in-memory-activity-gateway';
import type { InMemoryYearPlanGateway } from './in-memory-year-plan-gateways';

const samePeriod = (a: Period, b: Period) => a.year === b.year && a.month === b.month;
const counts = (t: Transaction) => t.status === 'confirmed' && t.deletedAt === null;
const signed = (t: Transaction, amount: number) => (t.kind === 'refund' ? -amount : amount);

/**
 * Transactions in memory, plus the read views the adapters derive from them in SQL (actuals, paid per year line,
 * yearly spend), so a test can follow an expense through to the month, the year plan and the pot.
 */
export class InMemoryTransactionGateway implements TransactionGateway {
  rows = new Map<string, Transaction>();

  async findById(familyId: string, id: string) {
    const row = this.rows.get(id);
    return row?.familyId === familyId ? row : undefined;
  }
  async insert(transaction: Transaction) {
    if (this.rows.has(transaction.id)) return false;
    this.rows.set(transaction.id, transaction);
    return true;
  }
  async update(transaction: Transaction) {
    if (this.rows.get(transaction.id)?.familyId === transaction.familyId) this.rows.set(transaction.id, transaction);
  }
  async list(familyId: string, filter: ExpenseFilter) {
    return [...this.rows.values()]
      .filter((t) => t.familyId === familyId && t.deletedAt === null && samePeriod(t.period, filter.period))
      .filter((t) => !filter.itemId || t.allocations.some((a) => a.itemId === filter.itemId))
      .filter((t) => !filter.enteredBy || t.enteredBy === filter.enteredBy)
      .sort((a, b) => b.txnDate.localeCompare(a.txnDate) || b.createdAt.getTime() - a.createdAt.getTime());
  }
  count() {
    return this.rows.size;
  }

  actuals(): ActualsGateway {
    const rows = () => [...this.rows.values()].filter(counts);
    return {
      sumByItem: async (familyId, period) => {
        const sums = new Map<string, number>();
        for (const t of rows()) {
          if (t.familyId !== familyId || !samePeriod(t.period, period)) continue;
          for (const a of t.allocations) sums.set(a.itemId, (sums.get(a.itemId) ?? 0) + signed(t, a.amountMinor));
        }
        return sums;
      },
      hasExpenses: async (familyId, period) => rows().some((t) => t.familyId === familyId && t.kind === 'expense' && samePeriod(t.period, period)),
    };
  }

  yearPaid(yearPlans: InMemoryYearPlanGateway): YearPaidGateway {
    return {
      paidByLine: async (familyId, year) => {
        const plan = await yearPlans.findByYear(familyId, year);
        const paid = new Map<string, number>();
        for (const line of plan?.lines ?? []) {
          let total = 0;
          for (const t of this.rows.values()) {
            if (!counts(t) || t.familyId !== familyId) continue;
            for (const a of t.allocations) if (a.itemId === line.itemId && a.planYear === year) total += signed(t, a.amountMinor);
          }
          if (total !== 0) paid.set(line.id, total);
        }
        return paid;
      },
    };
  }

  yearlySpend(familyId: string, isYearly: (itemId: string) => boolean): number {
    let total = 0;
    for (const t of this.rows.values()) {
      if (!counts(t) || t.familyId !== familyId) continue;
      for (const a of t.allocations) if (isYearly(a.itemId)) total += signed(t, a.amountMinor);
    }
    return total;
  }
}

export class InMemoryExpensesUnitOfWork implements ExpensesUnitOfWork {
  readonly activity = new InMemoryActivityGateway();
  failActivity = false;

  constructor(readonly transactions: InMemoryTransactionGateway) {}

  async run<T>(work: (gateways: { transactions: TransactionGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    const snapshot = { rows: new Map(this.transactions.rows), activity: this.activity.snapshot() };
    try {
      return await work({ transactions: this.transactions, activity: new FailingActivityGateway(this.activity, () => this.failActivity) });
    } catch (error) {
      this.transactions.rows = snapshot.rows;
      this.activity.restore(snapshot.activity);
      throw error;
    }
  }
}
