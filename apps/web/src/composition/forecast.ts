import 'server-only';
import type { Db } from '@nestwise/db';
import { GetForecastUseCase, GetHomeSummaryUseCase } from '@nestwise/domain/forecast';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { DrizzlePotGateway } from '../adapters/pot/drizzle-pot-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { DrizzleYearPaidGateway } from '../adapters/year-plan/drizzle-year-paid-gateway';
import { DrizzleYearPlanGateway } from '../adapters/year-plan/drizzle-year-plan-gateway';
import { getDb } from './db';
import { makeGetMonthSummaryUseCase } from './month-budget';
import { makeGetChecklistUseCase } from './pot';

export const makeGetForecastUseCase = (db: Db = getDb()) =>
  new GetForecastUseCase(
    new DrizzleFamilyGateway(db),
    new DrizzlePotGateway(db),
    new DrizzleYearPlanGateway(db),
    new DrizzleYearPaidGateway(db),
    new DrizzlePlanGateway(db),
    systemClock,
  );

export const makeGetHomeSummaryUseCase = (db: Db = getDb()) =>
  new GetHomeSummaryUseCase(makeGetForecastUseCase(db), makeGetChecklistUseCase(db), makeGetMonthSummaryUseCase(db));
