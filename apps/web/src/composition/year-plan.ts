import 'server-only';
import type { Db } from '@nestwise/db';
import {
  ApplyFirstYearCheckUseCase,
  CancelYearLineUseCase,
  EnsureYearPlanUseCase,
  GetYearPlanUseCase,
  MarkYearLineDoneUseCase,
  SetYearLineScheduleUseCase,
} from '@nestwise/domain/year-plan';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { DrizzleYearPaidGateway } from '../adapters/year-plan/drizzle-year-paid-gateway';
import { DrizzleYearPlanGateway } from '../adapters/year-plan/drizzle-year-plan-gateway';
import { DrizzleYearPlanUnitOfWork } from '../adapters/year-plan/drizzle-year-plan-unit-of-work';
import { getDb } from './db';

export const makeEnsureYearPlanUseCase = (db: Db = getDb()) =>
  new EnsureYearPlanUseCase(new DrizzleYearPlanGateway(db), new DrizzlePlanGateway(db), uuidIds);

export const makeSetYearLineScheduleUseCase = (db: Db = getDb()) =>
  new SetYearLineScheduleUseCase(new DrizzleYearPlanUnitOfWork(db), new DrizzleYearPlanGateway(db), systemClock);

export const makeMarkYearLineDoneUseCase = (db: Db = getDb()) =>
  new MarkYearLineDoneUseCase(new DrizzleYearPlanUnitOfWork(db), new DrizzleYearPlanGateway(db), systemClock);

export const makeCancelYearLineUseCase = (db: Db = getDb()) =>
  new CancelYearLineUseCase(new DrizzleYearPlanUnitOfWork(db), new DrizzleYearPlanGateway(db), new DrizzleYearPaidGateway(db), systemClock);

export const makeApplyFirstYearCheckUseCase = (db: Db = getDb()) =>
  new ApplyFirstYearCheckUseCase(new DrizzleYearPlanUnitOfWork(db), makeEnsureYearPlanUseCase(db), systemClock);

export const makeGetYearPlanUseCase = (db: Db = getDb()) =>
  new GetYearPlanUseCase(
    makeEnsureYearPlanUseCase(db),
    new DrizzleYearPlanGateway(db),
    new DrizzleYearPaidGateway(db),
    new DrizzleFamilyGateway(db),
    systemClock,
  );
