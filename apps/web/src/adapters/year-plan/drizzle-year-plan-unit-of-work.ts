import 'server-only';
import type { Db } from '@nestwise/db';
import type { ActivityGateway } from '@nestwise/domain/shared';
import type { YearPlanGateway, YearPlanUnitOfWork } from '@nestwise/domain/year-plan';
import { DrizzleActivityGateway } from '../activity/drizzle-activity-gateway';
import { DrizzleYearPlanGateway } from './drizzle-year-plan-gateway';

export class DrizzleYearPlanUnitOfWork implements YearPlanUnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: (gateways: { yearPlans: YearPlanGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work({ yearPlans: new DrizzleYearPlanGateway(tx), activity: new DrizzleActivityGateway(tx) }));
  }
}
