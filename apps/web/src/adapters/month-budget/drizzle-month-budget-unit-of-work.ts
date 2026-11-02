import 'server-only';
import type { Db } from '@nestwise/db';
import type { MonthBudgetGateway, MonthBudgetUnitOfWork } from '@nestwise/domain/month-budget';
import type { ActivityGateway } from '@nestwise/domain/shared';
import { DrizzleActivityGateway } from '../activity/drizzle-activity-gateway';
import { DrizzleMonthBudgetGateway } from './drizzle-month-budget-gateway';

export class DrizzleMonthBudgetUnitOfWork implements MonthBudgetUnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: (gateways: { budgets: MonthBudgetGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work({ budgets: new DrizzleMonthBudgetGateway(tx), activity: new DrizzleActivityGateway(tx) }));
  }
}
