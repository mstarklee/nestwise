import 'server-only';
import type { Db } from '@nestwise/db';
import {
  ApplyTemplateToMonthsUseCase,
  AutoCloseMonthUseCase,
  CloseMonthUseCase,
  CopyOrBlankMonthUseCase,
  EnsureMonthBudgetUseCase,
  GetMonthSummaryUseCase,
  PreviewFutureMonthsUseCase,
  SetMonthLineUseCase,
} from '@nestwise/domain/month-budget';
import type { Clock } from '@nestwise/domain/shared';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzleActualsGateway } from '../adapters/month-budget/drizzle-actuals-gateway';
import { DrizzleMonthBudgetGateway } from '../adapters/month-budget/drizzle-month-budget-gateway';
import { DrizzleMonthBudgetUnitOfWork } from '../adapters/month-budget/drizzle-month-budget-unit-of-work';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { getDb } from './db';

export const makeEnsureMonthBudgetUseCase = (db: Db = getDb()) =>
  new EnsureMonthBudgetUseCase(new DrizzleMonthBudgetGateway(db), new DrizzlePlanGateway(db), uuidIds);

export const makeSetMonthLineUseCase = (db: Db = getDb()) =>
  new SetMonthLineUseCase(new DrizzleMonthBudgetUnitOfWork(db), makeEnsureMonthBudgetUseCase(db), new DrizzlePlanGateway(db), uuidIds, systemClock);

export const makeCopyOrBlankMonthUseCase = (db: Db = getDb()) =>
  new CopyOrBlankMonthUseCase(
    new DrizzleMonthBudgetUnitOfWork(db),
    makeEnsureMonthBudgetUseCase(db),
    new DrizzleMonthBudgetGateway(db),
    new DrizzleActualsGateway(db),
    uuidIds,
    systemClock,
  );

export const makeGetMonthSummaryUseCase = (db: Db = getDb()) =>
  new GetMonthSummaryUseCase(makeEnsureMonthBudgetUseCase(db), new DrizzleActualsGateway(db), new DrizzlePlanGateway(db));

export const makeCloseMonthUseCase = (db: Db = getDb()) => new CloseMonthUseCase(new DrizzleMonthBudgetUnitOfWork(db), new DrizzleFamilyGateway(db), systemClock);

export const makeAutoCloseMonthUseCase = (db: Db = getDb(), clock: Clock = systemClock) => new AutoCloseMonthUseCase(new DrizzleMonthBudgetUnitOfWork(db), clock);

export const makePreviewFutureMonthsUseCase = (db: Db = getDb()) => new PreviewFutureMonthsUseCase(new DrizzleMonthBudgetGateway(db), new DrizzleFamilyGateway(db), systemClock);

export const makeApplyTemplateToMonthsUseCase = (db: Db = getDb()) =>
  new ApplyTemplateToMonthsUseCase(
    new DrizzleMonthBudgetUnitOfWork(db),
    new DrizzleMonthBudgetGateway(db),
    new DrizzlePlanGateway(db),
    new DrizzleFamilyGateway(db),
    uuidIds,
    systemClock,
  );
