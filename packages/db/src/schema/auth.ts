import { index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { app } from './app-schema';

/** Our own accounts: email + password and/or Google (owner's decisions, 2026-11-02 and 2026-11-06; no Supabase Auth). */
export const users = app.table('users', {
  id: uuid().primaryKey(),
  /** Lower-case and trimmed by the domain before it gets here. */
  email: text().notNull().unique(),
  /** scrypt hash; the password itself is never stored. Null for a Google-only account. */
  passwordHash: text(),
  /** When the email was proved (verify link, password reset or Google). Null until then. */
  emailVerifiedAt: timestamp({ withTimezone: true }),
  /** Google's stable account id ("sub"), once joined. */
  googleSubject: text().unique(),
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

/** Single-use tokens behind emailed links (verify email, reset password). Only a SHA-256 hash is stored. */
export const authTokens = app.table(
  'auth_tokens',
  {
    tokenHash: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'verify_email' | 'reset_password' */
    purpose: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Set when the link is used or replaced by a newer one; a token with this set never works again. */
    usedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('auth_tokens_user_purpose_idx').on(t.userId, t.purpose)],
);
