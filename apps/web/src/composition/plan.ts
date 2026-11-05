import 'server-only';
import type { Db } from '@nestwise/db';
import {
  AddItemUseCase,
  ArchiveItemUseCase,
  EnsureMiscellaneousItemUseCase,
  GetTemplatesUseCase,
  ImportPlanUseCase,
  ReorderItemsUseCase,
  UpdateItemUseCase,
} from '@nestwise/domain/plan';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { DrizzlePlanUnitOfWork } from '../adapters/plan/drizzle-plan-unit-of-work';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { getDb } from './db';

export const makeImportPlanUseCase = (db: Db = getDb()) =>
  new ImportPlanUseCase(new DrizzlePlanUnitOfWork(db), new DrizzlePlanGateway(db), uuidIds, systemClock);

export const makeGetTemplatesUseCase = (db: Db = getDb()) => new GetTemplatesUseCase(new DrizzlePlanGateway(db));

export const makeAddItemUseCase = (db: Db = getDb()) =>
  new AddItemUseCase(new DrizzlePlanUnitOfWork(db), new DrizzlePlanGateway(db), uuidIds, systemClock);

export const makeUpdateItemUseCase = (db: Db = getDb()) =>
  new UpdateItemUseCase(new DrizzlePlanUnitOfWork(db), new DrizzlePlanGateway(db), systemClock);

export const makeArchiveItemUseCase = (db: Db = getDb()) =>
  new ArchiveItemUseCase(new DrizzlePlanUnitOfWork(db), new DrizzlePlanGateway(db), systemClock);

export const makeReorderItemsUseCase = (db: Db = getDb()) =>
  new ReorderItemsUseCase(new DrizzlePlanUnitOfWork(db), new DrizzlePlanGateway(db), systemClock);

/** Called only from voice capture, which has already checked the role; never give this one a route of its own. */
export const makeEnsureMiscellaneousItemUseCase = (db: Db = getDb()) =>
  new EnsureMiscellaneousItemUseCase(new DrizzlePlanUnitOfWork(db), new DrizzlePlanGateway(db), uuidIds, systemClock);
