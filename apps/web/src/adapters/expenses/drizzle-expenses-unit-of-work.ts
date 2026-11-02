import 'server-only';
import type { Db } from '@nestwise/db';
import type { ExpensesUnitOfWork, TransactionGateway } from '@nestwise/domain/expenses';
import type { ActivityGateway } from '@nestwise/domain/shared';
import { DrizzleActivityGateway } from '../activity/drizzle-activity-gateway';
import { DrizzleTransactionGateway } from './drizzle-transaction-gateway';

export class DrizzleExpensesUnitOfWork implements ExpensesUnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: (gateways: { transactions: TransactionGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work({ transactions: new DrizzleTransactionGateway(tx), activity: new DrizzleActivityGateway(tx) }));
  }
}
