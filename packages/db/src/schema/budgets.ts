import { sql } from 'drizzle-orm';
import { check, index, integer, smallint, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { app, money } from './app-schema';
import { families } from './families';
import { items } from './plan';

export const monthBudgets = app.table(
  'month_budgets',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    year: integer().notNull(),
    month: smallint().notNull(),
    status: text({ enum: ['draft', 'active', 'closed'] }).notNull(),
    createdFrom: text({ enum: ['template', 'copy', 'blank'] }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
    closedBy: uuid(),
  },
  (t) => [
    unique('month_budgets_family_period_key').on(t.familyId, t.year, t.month),
    check('month_budgets_month_check', sql`${t.month} between 1 and 12`),
    check('month_budgets_status_check', sql`${t.status} in ('draft', 'active', 'closed')`),
    check('month_budgets_created_from_check', sql`${t.createdFrom} in ('template', 'copy', 'blank')`),
  ],
);

/** Monthly and savings items of one month. Snapshots keep history readable after renames. */
export const monthLines = app.table(
  'month_lines',
  {
    id: uuid().primaryKey(),
    monthBudgetId: uuid()
      .notNull()
      .references(() => monthBudgets.id),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    itemId: uuid()
      .notNull()
      .references(() => items.id),
    nameSnapshot: text().notNull(),
    groupNameSnapshot: text().notNull(),
    plannedMinor: money().notNull(),
  },
  (t) => [
    unique('month_lines_budget_item_key').on(t.monthBudgetId, t.itemId),
    index('month_lines_family_idx').on(t.familyId),
    check('month_lines_planned_check', sql`${t.plannedMinor} >= 0`),
  ],
);

export const yearPlans = app.table(
  'year_plans',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    year: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Set once the first-year check has been answered; it never runs twice. */
    firstYearCheckAt: timestamp({ withTimezone: true }),
  },
  (t) => [unique('year_plans_family_year_key').on(t.familyId, t.year)],
);

export const yearLines = app.table(
  'year_lines',
  {
    id: uuid().primaryKey(),
    yearPlanId: uuid()
      .notNull()
      .references(() => yearPlans.id),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    itemId: uuid()
      .notNull()
      .references(() => items.id),
    nameSnapshot: text().notNull(),
    plannedMinor: money().notNull(),
    dueYear: integer().notNull(),
    dueMonth: smallint(),
    dueDay: smallint(),
    state: text({ enum: ['open', 'done', 'cancelled', 'before_nestwise'] }).notNull(),
  },
  (t) => [
    unique('year_lines_plan_item_key').on(t.yearPlanId, t.itemId),
    index('year_lines_family_idx').on(t.familyId),
    check('year_lines_planned_check', sql`${t.plannedMinor} >= 0`),
    check('year_lines_due_month_check', sql`${t.dueMonth} is null or ${t.dueMonth} between 1 and 12`),
    check('year_lines_due_day_check', sql`${t.dueDay} is null or ${t.dueDay} between 1 and 31`),
    check('year_lines_state_check', sql`${t.state} in ('open', 'done', 'cancelled', 'before_nestwise')`),
  ],
);
