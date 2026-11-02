import 'server-only';
import type { Db } from '@nestwise/db';
import {
  DeleteExpenseUseCase,
  EditExpenseUseCase,
  ListExpensesUseCase,
  RecordExpenseUseCase,
  RestoreExpenseUseCase,
} from '@nestwise/domain/expenses';
import { DrizzleExpensesUnitOfWork } from '../adapters/expenses/drizzle-expenses-unit-of-work';
import { DrizzleTransactionGateway } from '../adapters/expenses/drizzle-transaction-gateway';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzleMembershipGateway } from '../adapters/family/drizzle-membership-gateway';
import { DrizzlePlanGateway } from '../adapters/plan/drizzle-plan-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { getDb } from './db';
import { makeEnsureMonthBudgetUseCase } from './month-budget';

export const makeRecordExpenseUseCase = (db: Db = getDb()) =>
  new RecordExpenseUseCase(
    new DrizzleExpensesUnitOfWork(db),
    new DrizzleTransactionGateway(db),
    new DrizzlePlanGateway(db),
    new DrizzleMembershipGateway(db),
    new DrizzleFamilyGateway(db),
    makeEnsureMonthBudgetUseCase(db),
    systemClock,
  );

export const makeEditExpenseUseCase = (db: Db = getDb()) =>
  new EditExpenseUseCase(
    new DrizzleExpensesUnitOfWork(db),
    new DrizzleTransactionGateway(db),
    new DrizzlePlanGateway(db),
    new DrizzleMembershipGateway(db),
    makeEnsureMonthBudgetUseCase(db),
    systemClock,
  );

export const makeDeleteExpenseUseCase = (db: Db = getDb()) =>
  new DeleteExpenseUseCase(new DrizzleExpensesUnitOfWork(db), new DrizzleTransactionGateway(db), systemClock);

export const makeRestoreExpenseUseCase = (db: Db = getDb()) =>
  new RestoreExpenseUseCase(new DrizzleExpensesUnitOfWork(db), new DrizzleTransactionGateway(db), systemClock);

export const makeListExpensesUseCase = (db: Db = getDb()) => new ListExpensesUseCase(new DrizzleTransactionGateway(db));
