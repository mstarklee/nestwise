import { sql } from 'drizzle-orm';
import { char, check, index, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { app, money } from './app-schema';
import { users } from './auth';

export const families = app.table(
  'families',
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    currencyCode: char({ length: 3 }).notNull(),
    minorUnit: smallint().notNull(),
    numberLocale: text().notNull(),
    timezone: text().notNull(),
    countryCode: char({ length: 2 }),
    setAsideOverrideMinor: money(),
    alertThresholds: smallint().array().notNull().default(sql`'{80,100}'::smallint[]`),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('families_minor_unit_check', sql`${t.minorUnit} between 0 and 3`),
    check('families_set_aside_override_check', sql`${t.setAsideOverrideMinor} is null or ${t.setAsideOverrideMinor} >= 0`),
  ],
);

export const profiles = app.table('profiles', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id),
  displayName: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const members = app.table(
  'members',
  {
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    role: text({ enum: ['admin', 'member', 'viewer'] }).notNull(),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.familyId, t.userId] }),
    index('members_user_idx').on(t.userId),
    check('members_role_check', sql`${t.role} in ('admin', 'member', 'viewer')`),
  ],
);

export const invites = app.table(
  'invites',
  {
    id: uuid().primaryKey(),
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    role: text({ enum: ['admin', 'member', 'viewer'] }).notNull(),
    tokenHash: text().notNull().unique(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedBy: uuid(),
    usedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('invites_family_idx').on(t.familyId), check('invites_role_check', sql`${t.role} in ('admin', 'member', 'viewer')`)],
);
