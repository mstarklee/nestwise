import 'server-only';
import type { Db } from '@nestwise/db';
import type { PotGateway, PotUnitOfWork } from '@nestwise/domain/pot';
import type { ActivityGateway } from '@nestwise/domain/shared';
import { DrizzleActivityGateway } from '../activity/drizzle-activity-gateway';
import { DrizzlePotGateway } from './drizzle-pot-gateway';

export class DrizzlePotUnitOfWork implements PotUnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: (gateways: { pot: PotGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work({ pot: new DrizzlePotGateway(tx), activity: new DrizzleActivityGateway(tx) }));
  }
}
