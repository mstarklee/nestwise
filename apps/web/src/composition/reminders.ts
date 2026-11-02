import 'server-only';
import type { Db } from '@nestwise/db';
import { SavePushSubscriptionUseCase } from '@nestwise/domain/reminders';
import { DrizzlePushSubscriptionGateway } from '../adapters/reminders/drizzle-push-subscription-gateway';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { getDb } from './db';

export const makeSavePushSubscriptionUseCase = (db: Db = getDb()) => new SavePushSubscriptionUseCase(new DrizzlePushSubscriptionGateway(db), uuidIds);
