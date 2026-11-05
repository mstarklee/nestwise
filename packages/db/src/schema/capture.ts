import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { app, money } from './app-schema';
import { yearLines } from './budgets';
import { families } from './families';
import { items } from './plan';

/**
 * One recording's worth of spoken entries, waiting to be checked (design §8).
 *
 * Deliberately NOT transactions: `transactions.amount_minor` is `NOT NULL CHECK > 0` and `allocations.item_id` is
 * `NOT NULL`, so an entry whose amount was not heard — exactly the one that most needs a second look — cannot be a
 * transaction at all. `transactions.status = 'pending'` also already means "waiting for a duplicate answer" in
 * Stage 1b, and reusing it would change the meaning of live code.
 *
 * Nothing here reaches any total. Real transactions are written at confirm, through `RecordExpenseUseCase`.
 */
export const captureBatches = app.table(
  'capture_batches',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    /** Only this person may confirm the batch (design §8); there is no admin override. */
    createdBy: uuid().notNull(),
    transcript: text().notNull(),
    sttModel: text().notNull(),
    parseModel: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('capture_batches_waiting_idx').on(t.familyId, t.resolvedAt, t.createdAt)],
);

/** One heard expense. The amount and both targets are nullable on purpose: see the table comment above. */
export const captureEntries = app.table(
  'capture_entries',
  {
    id: uuid().primaryKey(),
    batchId: uuid()
      .notNull()
      .references(() => captureBatches.id, { onDelete: 'cascade' }),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    /** Null when the amount was not clearly heard. Never invented, never rounded to zero. */
    amountMinor: money(),
    itemId: uuid().references(() => items.id),
    yearLineId: uuid().references(() => yearLines.id),
    kind: text({ enum: ['expense', 'yearly_bill'] }).notNull(),
    txnDate: date({ mode: 'string' }).notNull(),
    merchant: text(),
    note: text().notNull(),
    /** The speaker's own words for this entry, shown on the review row. */
    heard: text().notNull(),
    confidenceAmount: real().notNull(),
    confidenceItem: real().notNull(),
    /** The person removed this row on the review screen; it writes nothing. */
    dropped: boolean().notNull().default(false),
    /** Keeps the order the entries were spoken in. */
    sort: integer().notNull(),
  },
  (t) => [
    index('capture_entries_batch_idx').on(t.batchId, t.sort),
    check('capture_entries_kind_check', sql`${t.kind} in ('expense', 'yearly_bill')`),
    check('capture_entries_amount_check', sql`${t.amountMinor} is null or ${t.amountMinor} > 0`),
    check('capture_entries_confidence_check', sql`${t.confidenceAmount} between 0 and 1 and ${t.confidenceItem} between 0 and 1`),
  ],
);
