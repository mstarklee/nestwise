import 'server-only';
import type { Db } from '@nestwise/db';
import type { PlanGateway, PlanUnitOfWork } from '@nestwise/domain/plan';
import type { ActivityGateway } from '@nestwise/domain/shared';
import { DrizzleActivityGateway } from '../activity/drizzle-activity-gateway';
import { DrizzlePlanGateway } from './drizzle-plan-gateway';

export class DrizzlePlanUnitOfWork implements PlanUnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: (gateways: { plan: PlanGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work({ plan: new DrizzlePlanGateway(tx), activity: new DrizzleActivityGateway(tx) }));
  }
}
