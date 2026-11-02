import 'server-only';
import type { Db } from '@nestwise/db';
import { AcceptInviteUseCase, CreateFamilyUseCase, CreateInviteUseCase, ResolveActorUseCase } from '@nestwise/domain/family';
import { DrizzleFamilyUnitOfWork } from '../adapters/family/drizzle-family-unit-of-work';
import { DrizzleInviteGateway } from '../adapters/family/drizzle-invite-gateway';
import { DrizzleMembershipGateway } from '../adapters/family/drizzle-membership-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { getDb } from './db';

export const makeCreateFamilyUseCase = (db: Db = getDb()) =>
  new CreateFamilyUseCase(new DrizzleFamilyUnitOfWork(db), new DrizzleMembershipGateway(db), uuidIds, systemClock);

export const makeCreateInviteUseCase = (db: Db = getDb()) =>
  new CreateInviteUseCase(new DrizzleInviteGateway(db), uuidIds, systemClock);

export const makeAcceptInviteUseCase = (db: Db = getDb()) =>
  new AcceptInviteUseCase(new DrizzleFamilyUnitOfWork(db), new DrizzleInviteGateway(db), new DrizzleMembershipGateway(db), systemClock);

export const makeResolveActorUseCase = (db: Db = getDb()) => new ResolveActorUseCase(new DrizzleMembershipGateway(db));
