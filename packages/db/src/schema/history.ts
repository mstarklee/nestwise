import { sql } from 'drizzle-orm';
import { bigserial, boolean, check, index, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { app } from './app-schema';
import { families } from './families';
import { transactions } from './money';

export const evidence = app.table(
  'evidence',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    transactionId: uuid().references(() => transactions.id),
    kind: text({ enum: ['voice', 'receipt', 'merged_entry'] }).notNull(),
    storagePath: text(),
    transcript: text(),
    extracted: jsonb(),
    confidence: jsonb(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('evidence_transaction_idx').on(t.transactionId),
    check('evidence_kind_check', sql`${t.kind} in ('voice', 'receipt', 'merged_entry')`),
  ],
);

export const duplicateMatches = app.table(
  'duplicate_matches',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    txnA: uuid()
      .notNull()
      .references(() => transactions.id),
    txnB: uuid()
      .notNull()
      .references(() => transactions.id),
    reasons: jsonb().notNull(),
    status: text({ enum: ['pending', 'same', 'different'] }).notNull(),
    resolvedBy: uuid(),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One row per unordered pair.
    uniqueIndex('duplicate_matches_pair_idx').on(sql`least(${t.txnA}, ${t.txnB})`, sql`greatest(${t.txnA}, ${t.txnB})`),
    check('duplicate_matches_status_check', sql`${t.status} in ('pending', 'same', 'different')`),
    check('duplicate_matches_distinct_check', sql`${t.txnA} <> ${t.txnB}`),
  ],
);

/** Append-only history: the app role has no UPDATE or DELETE on it (0001_guards.sql). */
export const activity = app.table(
  'activity',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    actorId: uuid().notNull(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    at: timestamp({ withTimezone: true }).notNull(),
    /** A change to a month that was already closed (PRD §6.3). */
    lateEdit: boolean().notNull().default(false),
  },
  (t) => [index('activity_family_at_idx').on(t.familyId, t.at)],
);
