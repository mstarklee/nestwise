import { sql } from 'drizzle-orm';
import { char, check, date, index, integer, smallint, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { app, money } from './app-schema';
import { families } from './families';
import { items } from './plan';

export const transactions = app.table(
  'transactions',
  {
    /** Client-made UUID v7, so a resend from the offline outbox is recognised. */
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    kind: text({ enum: ['expense', 'refund'] }).notNull(),
    amountMinor: money().notNull(),
    currencyCode: char({ length: 3 }).notNull(),
    /** The local date in the family's time zone; it decides the period. */
    txnDate: date({ mode: 'string' }).notNull(),
    periodYear: integer().generatedAlwaysAs(sql`(extract(year from txn_date))::integer`),
    periodMonth: integer().generatedAlwaysAs(sql`(extract(month from txn_date))::integer`),
    merchant: text(),
    note: text(),
    enteredBy: uuid().notNull(),
    paidBy: uuid(),
    captureMethod: text({ enum: ['typed', 'voice', 'receipt'] }).notNull(),
    status: text({ enum: ['pending', 'confirmed'] }).notNull(),
    mergedInto: uuid(),
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    entryTz: text().notNull(),
  },
  (t) => [
    index('transactions_family_period_idx').on(t.familyId, t.periodYear, t.periodMonth),
    check('transactions_amount_check', sql`${t.amountMinor} > 0`),
    check('transactions_kind_check', sql`${t.kind} in ('expense', 'refund')`),
    check('transactions_capture_check', sql`${t.captureMethod} in ('typed', 'voice', 'receipt')`),
    check('transactions_status_check', sql`${t.status} in ('pending', 'confirmed')`),
  ],
);

/** Split support: the parts must add up to the transaction amount (deferred trigger in 0001_guards.sql). */
export const allocations = app.table(
  'allocations',
  {
    id: uuid().primaryKey(),
    transactionId: uuid()
      .notNull()
      .references(() => transactions.id),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    itemId: uuid()
      .notNull()
      .references(() => items.id),
    /** For yearly items: which year's plan the money pays; defaults to the year of txn_date. */
    planYear: integer(),
    amountMinor: money().notNull(),
  },
  (t) => [
    index('allocations_transaction_idx').on(t.transactionId),
    index('allocations_family_item_idx').on(t.familyId, t.itemId),
    check('allocations_amount_check', sql`${t.amountMinor} > 0`),
  ],
);

export const potEntries = app.table(
  'pot_entries',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    kind: text({ enum: ['opening', 'deposit', 'extra_in', 'taken_out'] }).notNull(),
    amountMinor: money().notNull(),
    entryDate: date({ mode: 'string' }).notNull(),
    periodYear: integer().notNull(),
    periodMonth: smallint().notNull(),
    note: text(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('pot_entries_family_idx').on(t.familyId),
    uniqueIndex('pot_entries_one_live_deposit_idx')
      .on(t.familyId, t.periodYear, t.periodMonth)
      .where(sql`${t.kind} = 'deposit' and ${t.deletedAt} is null`),
    check('pot_entries_kind_check', sql`${t.kind} in ('opening', 'deposit', 'extra_in', 'taken_out')`),
    // An opening balance of 0 is allowed; every other movement is positive.
    check('pot_entries_amount_check', sql`${t.amountMinor} > 0 or (${t.kind} = 'opening' and ${t.amountMinor} >= 0)`),
    check('pot_entries_month_check', sql`${t.periodMonth} between 1 and 12`),
  ],
);

export const savingsEntries = app.table(
  'savings_entries',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    itemId: uuid()
      .notNull()
      .references(() => items.id),
    year: integer().notNull(),
    month: smallint().notNull(),
    amountMinor: money().notNull(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('savings_entries_family_item_period_key').on(t.familyId, t.itemId, t.year, t.month),
    check('savings_entries_amount_check', sql`${t.amountMinor} >= 0`),
    check('savings_entries_month_check', sql`${t.month} between 1 and 12`),
  ],
);

/** "Not this month" answers. item_id null means the pot deposit. */
export const checklistSkips = app.table(
  'checklist_skips',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    year: integer().notNull(),
    month: smallint().notNull(),
    itemId: uuid().references(() => items.id),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('checklist_skips_family_period_item_key').on(t.familyId, t.year, t.month, t.itemId).nullsNotDistinct(),
    check('checklist_skips_month_check', sql`${t.month} between 1 and 12`),
  ],
);
