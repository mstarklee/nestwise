import 'server-only';
import type { Db } from '@nestwise/db';
import type { FamilyGateways, FamilyUnitOfWork } from '@nestwise/domain/family';
import { DrizzleActivityGateway } from '../activity/drizzle-activity-gateway';
import { DrizzleFamilyGateway } from './drizzle-family-gateway';
import { DrizzleInviteGateway } from './drizzle-invite-gateway';
import { DrizzleMembershipGateway } from './drizzle-membership-gateway';
import { DrizzleOpeningPotGateway } from './drizzle-opening-pot-gateway';

/** One database transaction: everything the work writes commits together or not at all. */
export class DrizzleFamilyUnitOfWork implements FamilyUnitOfWork {
  constructor(private readonly db: Db) {}

  run<T>(work: (gateways: FamilyGateways) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        families: new DrizzleFamilyGateway(tx),
        memberships: new DrizzleMembershipGateway(tx),
        invites: new DrizzleInviteGateway(tx),
        openingPot: new DrizzleOpeningPotGateway(tx),
        activity: new DrizzleActivityGateway(tx),
      }),
    );
  }
}
