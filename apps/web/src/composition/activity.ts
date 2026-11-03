import 'server-only';
import type { Db } from '@nestwise/db';
import { ListActivityUseCase } from '@nestwise/domain/activity';
import { ListLedgerUseCase } from '@nestwise/domain/expenses';
import { DrizzleActivityReader } from '../adapters/activity/drizzle-activity-reader';
import { DrizzleEvidenceGateway } from '../adapters/duplicates/drizzle-evidence-gateway';
import { DrizzleTransactionGateway } from '../adapters/expenses/drizzle-transaction-gateway';
import { getDb } from './db';

export const makeListActivityUseCase = (db: Db = getDb()) => new ListActivityUseCase(new DrizzleActivityReader(db));

export const makeListLedgerUseCase = (db: Db = getDb()) => new ListLedgerUseCase(new DrizzleTransactionGateway(db), new DrizzleEvidenceGateway(db));
