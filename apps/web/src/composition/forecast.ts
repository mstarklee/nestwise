import 'server-only';
import type { Db } from '@nestwise/db';
import { GetForecastUseCase, GetHomeSummaryUseCase } from '@nestwise/domain/forecast';
import type { Clock } from '@nestwise/domain/shared';
import { DrizzleCaptureGateway } from '../adapters/capture/drizzle-capture-gateway';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzleMonthBudgetGateway } from '../adapters/month-budget/drizzle-month-budget-gateway';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { DrizzlePotGateway } from '../adapters/pot/drizzle-pot-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { DrizzleYearPaidGateway } from '../adapters/year-plan/drizzle-year-paid-gateway';
import { DrizzleYearPlanGateway } from '../adapters/year-plan/drizzle-year-plan-gateway';
import { getDb } from './db';
import { makeGetMonthSummaryUseCase } from './month-budget';
import { makeGetChecklistUseCase } from './pot';
import { makeGetYearEndReviewUseCase } from './year-plan';

/** The clock is a parameter so the daily job can run the forecast for the instant it was started with. */
export const makeGetForecastUseCase = (db: Db = getDb(), clock: Clock = systemClock) =>
  new GetForecastUseCase(
    new DrizzleFamilyGateway(db),
    new DrizzlePotGateway(db),
    new DrizzleYearPlanGateway(db),
    new DrizzleYearPaidGateway(db),
    new DrizzlePlanGateway(db),
    clock,
  );

export const makeGetHomeSummaryUseCase = (db: Db = getDb()) =>
  new GetHomeSummaryUseCase(
    makeGetForecastUseCase(db),
    makeGetChecklistUseCase(db),
    makeGetMonthSummaryUseCase(db),
    new DrizzleMonthBudgetGateway(db),
    new DrizzleYearPlanGateway(db),
    makeGetYearEndReviewUseCase(db),
    new DrizzleCaptureGateway(db),
  );
