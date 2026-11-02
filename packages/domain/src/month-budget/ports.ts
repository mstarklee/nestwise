import type { ActivityGateway, Period } from '../shared';
import type { MonthBudget, MonthCreatedFrom, MonthLine } from './models';

export interface MonthBudgetGateway {
  findByPeriod(familyId: string, period: Period): Promise<MonthBudget | undefined>;
  /** Creates the budget with its lines; if another request created that month first, returns that one instead. */
  create(budget: MonthBudget): Promise<MonthBudget>;
  /** Inserts or replaces the line for `line.itemId`. */
  saveLine(familyId: string, budgetId: string, line: MonthLine): Promise<void>;
  replaceLines(familyId: string, budgetId: string, createdFrom: MonthCreatedFrom, lines: readonly MonthLine[]): Promise<void>;
}

export interface ActualsGateway {
  /** Confirmed, not deleted, not merged allocations per item in the period; refunds subtracted. */
  sumByItem(familyId: string, period: Period): Promise<ReadonlyMap<string, number>>;
  hasExpenses(familyId: string, period: Period): Promise<boolean>;
}

export interface MonthBudgetUnitOfWork {
  run<T>(work: (gateways: { budgets: MonthBudgetGateway; activity: ActivityGateway }) => Promise<T>): Promise<T>;
}
