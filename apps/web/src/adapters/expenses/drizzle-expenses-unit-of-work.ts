import 'server-only';
import type { Db } from '@nestwise/db';
import type { ExpensesGateways, ExpensesUnitOfWork } from '@nestwise/domain/expenses';
import { DrizzleActivityGateway } from '../activity/drizzle-activity-gateway';
import { DrizzleDuplicateMatchGateway } from '../duplicates/drizzle-duplicate-match-gateway';
import { DrizzleEvidenceGateway } from '../duplicates/drizzle-evidence-gateway';
import { DrizzleMonthBudgetGateway } from '../month-budget/drizzle-month-budget-gateway';
import { DrizzleTransactionGateway } from './drizzle-transaction-gateway';

export class DrizzleExpensesUnitOfWork implements ExpensesUnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: (gateways: ExpensesGateways) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        transactions: new DrizzleTransactionGateway(tx),
        activity: new DrizzleActivityGateway(tx),
        duplicates: new DrizzleDuplicateMatchGateway(tx),
        evidence: new DrizzleEvidenceGateway(tx),
        months: new DrizzleMonthBudgetGateway(tx),
      }),
    );
  }
}
