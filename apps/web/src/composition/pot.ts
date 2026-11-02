import 'server-only';
import type { Db } from '@nestwise/db';
import {
  ConfirmPotDepositUseCase,
  ConfirmSavingsUseCase,
  GetChecklistUseCase,
  GetPotBalanceUseCase,
  RecordPotMovementUseCase,
  SkipChecklistItemUseCase,
} from '@nestwise/domain/pot';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { DrizzlePotGateway } from '../adapters/pot/drizzle-pot-gateway';
import { DrizzlePotUnitOfWork } from '../adapters/pot/drizzle-pot-unit-of-work';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { DrizzleYearPlanGateway } from '../adapters/year-plan/drizzle-year-plan-gateway';
import { getDb } from './db';
import { makeEnsureMonthBudgetUseCase } from './month-budget';

export const makeConfirmPotDepositUseCase = (db: Db = getDb()) =>
  new ConfirmPotDepositUseCase(new DrizzlePotUnitOfWork(db), new DrizzlePotGateway(db), new DrizzleFamilyGateway(db), uuidIds, systemClock);

export const makeConfirmSavingsUseCase = (db: Db = getDb()) =>
  new ConfirmSavingsUseCase(new DrizzlePotUnitOfWork(db), new DrizzlePotGateway(db), new DrizzlePlanGateway(db), uuidIds, systemClock);

export const makeSkipChecklistItemUseCase = (db: Db = getDb()) =>
  new SkipChecklistItemUseCase(new DrizzlePotUnitOfWork(db), new DrizzlePotGateway(db), new DrizzlePlanGateway(db), uuidIds, systemClock);

export const makeRecordPotMovementUseCase = (db: Db = getDb()) =>
  new RecordPotMovementUseCase(new DrizzlePotUnitOfWork(db), new DrizzleFamilyGateway(db), uuidIds, systemClock);

export const makeGetChecklistUseCase = (db: Db = getDb()) =>
  new GetChecklistUseCase(
    makeEnsureMonthBudgetUseCase(db),
    new DrizzleYearPlanGateway(db),
    new DrizzlePlanGateway(db),
    new DrizzleFamilyGateway(db),
    new DrizzlePotGateway(db),
  );

export const makeGetPotBalanceUseCase = (db: Db = getDb()) => new GetPotBalanceUseCase(new DrizzlePotGateway(db));
