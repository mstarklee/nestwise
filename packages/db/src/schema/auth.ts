import { index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { app } from './app-schema';

/** Our own email + password accounts (owner's decision, 2026-11-02; no Supabase Auth). */
export const users = app.table('users', {
  id: uuid().primaryKey(),
  /** Lower-case and trimmed by the domain before it gets here. */
  email: text().notNull().unique(),
  /** scrypt hash; the password itself is never stored. */
  passwordHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Signed-in sessions. Only a SHA-256 hash of the token is stored; the raw token lives in the browser cookie. */
export const sessions = app.table(
  'sessions',
  {
    tokenHash: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);
