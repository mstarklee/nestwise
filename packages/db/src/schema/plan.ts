import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { app, money } from './app-schema';
import { families } from './families';

const KINDS = ['monthly', 'yearly', 'savings'] as const;
const kindCheck = (column: unknown) => sql`${column} in ('monthly', 'yearly', 'savings')`;

export const groups = app.table(
  'groups',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    kind: text({ enum: KINDS }).notNull(),
    name: text().notNull(),
    sort: integer().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('groups_family_idx').on(t.familyId), check('groups_kind_check', kindCheck(t.kind))],
);

/** The stable identity of an item across every month and year. */
export const items = app.table(
  'items',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    groupId: uuid()
      .notNull()
      .references(() => groups.id),
    kind: text({ enum: KINDS }).notNull(),
    name: text().notNull(),
    sort: integer().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    seedKey: text(),
    /** A monthly bill shown on Home with done or not done (2026-11-08). Only monthly items carry it. */
    isBill: boolean().notNull().default(false),
  },
  (t) => [
    index('items_family_idx').on(t.familyId),
    uniqueIndex('items_family_seed_key_idx').on(t.familyId, t.seedKey).where(sql`${t.seedKey} is not null`),
    check('items_kind_check', kindCheck(t.kind)),
    check('items_bill_monthly_check', sql`not ${t.isBill} or ${t.kind} = 'monthly'`),
  ],
);

/** One row per item: this is the template. Due fields apply to yearly items only. */
export const templateLines = app.table(
  'template_lines',
  {
    itemId: uuid()
      .primaryKey()
      .references(() => items.id),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    amountMinor: money().notNull().default(0),
    dueMonth: smallint(),
    dueDay: smallint(),
    hintMinMinor: money(),
    hintMaxMinor: money(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('template_lines_family_idx').on(t.familyId),
    check('template_lines_amount_check', sql`${t.amountMinor} >= 0`),
    check('template_lines_due_month_check', sql`${t.dueMonth} is null or ${t.dueMonth} between 1 and 12`),
    check('template_lines_due_day_check', sql`${t.dueDay} is null or ${t.dueDay} between 1 and 31`),
  ],
);
