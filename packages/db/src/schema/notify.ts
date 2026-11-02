import { integer, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { app } from './app-schema';
import { families } from './families';

export const pushSubscriptions = app.table('push_subscriptions', {
  id: uuid().primaryKey(),
  userId: uuid().notNull(),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  userAgent: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastOkAt: timestamp({ withTimezone: true }),
  failedCount: integer().notNull().default(0),
});

/** Guarantees each reminder is sent once per user. */
export const notificationsSent = app.table(
  'notifications_sent',
  {
    userId: uuid().notNull(),
    dedupeKey: text().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dedupeKey] })],
);

export const usage = app.table(
  'usage',
  {
    familyId: uuid()
      .notNull()
      .references(() => families.id),
    year: integer().notNull(),
    month: smallint().notNull(),
    voiceCount: integer().notNull().default(0),
    voiceSeconds: integer().notNull().default(0),
    receiptCount: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.year, t.month] })],
);
