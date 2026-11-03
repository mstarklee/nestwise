import 'server-only';
import type { Db } from '@nestwise/db';
import { GetMonthReviewUseCase } from '@nestwise/domain/month-budget';
import { DrizzleTransactionGateway } from '../adapters/expenses/drizzle-transaction-gateway';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzleMonthBudgetGateway } from '../adapters/month-budget/drizzle-month-budget-gateway';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { getDb } from './db';
import { makeListInboxUseCase } from './duplicates';
import { makeGetMonthSummaryUseCase } from './month-budget';
import { makeGetChecklistUseCase } from './pot';
import { makeGetYearPlanUseCase } from './year-plan';

export const makeGetMonthReviewUseCase = (db: Db = getDb()) =>
  new GetMonthReviewUseCase(
    makeGetMonthSummaryUseCase(db),
    new DrizzleMonthBudgetGateway(db),
    new DrizzleTransactionGateway(db),
    new DrizzlePlanGateway(db),
    makeGetYearPlanUseCase(db),
    makeGetChecklistUseCase(db),
    makeListInboxUseCase(db),
    new DrizzleFamilyGateway(db),
  );
