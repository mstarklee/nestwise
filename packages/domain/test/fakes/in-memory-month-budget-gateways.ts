import type {
  ActualsGateway,
  MonthBudget,
  MonthBudgetGateway,
  MonthBudgetUnitOfWork,
  MonthCreatedFrom,
  MonthLine,
} from '../../src/month-budget';
import type { ActivityGateway, Period } from '../../src/shared';
import { InMemoryActivityGateway } from './in-memory-activity-gateway';

const key = (familyId: string, p: Period) => `${familyId}:${p.year}-${p.month}`;

export class InMemoryMonthBudgetGateway implements MonthBudgetGateway {
  rows = new Map<string, MonthBudget>();

  async findByPeriod(familyId: string, period: Period) {
    return this.rows.get(key(familyId, period));
  }
  async create(budget: MonthBudget) {
    const existing = this.rows.get(key(budget.familyId, budget.period));
    if (existing) return existing; // like the adapter after a unique violation
    this.rows.set(key(budget.familyId, budget.period), budget);
    return budget;
  }
  async saveLine(familyId: string, budgetId: string, line: MonthLine) {
    for (const [k, b] of this.rows) {
      if (b.id === budgetId && b.familyId === familyId) {
        const others = b.lines.filter((l) => l.itemId !== line.itemId);
        this.rows.set(k, { ...b, lines: [...others, line] });
      }
    }
  }
  async replaceLines(familyId: string, budgetId: string, createdFrom: MonthCreatedFrom, lines: readonly MonthLine[]) {
    for (const [k, b] of this.rows) {
      if (b.id === budgetId && b.familyId === familyId) this.rows.set(k, { ...b, createdFrom, lines: [...lines] });
    }
  }
  count() {
    return this.rows.size;
  }
}

export class InMemoryActualsGateway implements ActualsGateway {
  sums = new Map<string, Map<string, number>>();

  set(familyId: string, period: Period, sums: ReadonlyMap<string, number>) {
    this.sums.set(key(familyId, period), new Map(sums));
  }
  async sumByItem(familyId: string, period: Period) {
    return this.sums.get(key(familyId, period)) ?? new Map<string, number>();
  }
  async hasExpenses(familyId: string, period: Period) {
    return (this.sums.get(key(familyId, period))?.size ?? 0) > 0;
  }
}

export class InMemoryMonthBudgetUnitOfWork implements MonthBudgetUnitOfWork {
  constructor(
    readonly budgets: InMemoryMonthBudgetGateway,
    readonly activity = new InMemoryActivityGateway(),
  ) {}

  async run<T>(work: (gateways: { budgets: MonthBudgetGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    const snapshot = { rows: new Map(this.budgets.rows), activity: this.activity.snapshot() };
    try {
      return await work({ budgets: this.budgets, activity: this.activity });
    } catch (error) {
      this.budgets.rows = snapshot.rows;
      this.activity.restore(snapshot.activity);
      throw error;
    }
  }
}
