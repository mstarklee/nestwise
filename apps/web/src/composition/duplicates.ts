import 'server-only';
import type { Db } from '@nestwise/db';
import { ListInboxUseCase, ResolveDuplicateUseCase } from '@nestwise/domain/duplicates';
import { DrizzleCaptureGateway } from '../adapters/capture/drizzle-capture-gateway';
import { DrizzleDuplicateMatchGateway } from '../adapters/duplicates/drizzle-duplicate-match-gateway';
import { DrizzleExpensesUnitOfWork } from '../adapters/expenses/drizzle-expenses-unit-of-work';
import { DrizzleTransactionGateway } from '../adapters/expenses/drizzle-transaction-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { getDb } from './db';

export const makeResolveDuplicateUseCase = (db: Db = getDb()) => new ResolveDuplicateUseCase(new DrizzleExpensesUnitOfWork(db), uuidIds, systemClock);

export const makeListInboxUseCase = (db: Db = getDb()) =>
  new ListInboxUseCase(new DrizzleDuplicateMatchGateway(db), new DrizzleTransactionGateway(db), new DrizzleCaptureGateway(db));
