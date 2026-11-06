import 'server-only';
import type { Db } from '@nestwise/db';
import {
  type AccountEmailGateway,
  ConfirmEmailUseCase,
  RequestPasswordResetUseCase,
  ResendVerificationUseCase,
  ResetPasswordUseCase,
  ResolveSessionUseCase,
  SignInUseCase,
  SignInWithGoogleUseCase,
  SignOutUseCase,
  SignUpUseCase,
} from '@nestwise/domain/auth';
import { AccountEmailSender } from '../adapters/auth/account-email-sender';
import { DrizzleOneTimeTokenGateway } from '../adapters/auth/drizzle-one-time-token-gateway';
import { DrizzleSessionGateway } from '../adapters/auth/drizzle-session-gateway';
import { DrizzleUserGateway } from '../adapters/auth/drizzle-user-gateway';
import { type GoogleClient, GoogleOAuthIdentityGateway } from '../adapters/auth/google-oauth-identity-gateway';
import { RandomTokenGenerator } from '../adapters/auth/random-token-generator';
import { ScryptPasswordHasher } from '../adapters/auth/scrypt-password-hasher';
import { SmtpEmailGateway } from '../adapters/reminders/smtp-email-gateway';
import { isTestRun, MemoryEmailGateway } from '../adapters/shared/memory-email-gateway';
import { systemClock } from '../adapters/shared/system-clock';
import { uuidIds } from '../adapters/shared/uuid-ids';
import { getDb } from './db';

/** The verify and reset emails, with links to `origin` (the app's address). Tests keep them in memory instead. */
export const makeAccountEmails = (origin: string): AccountEmailGateway =>
  new AccountEmailSender(isTestRun() ? new MemoryEmailGateway() : new SmtpEmailGateway(), origin.replace(/\/$/, ''));

/** Sends nothing: for the dev seed, whose account is fictional. */
export const noAccountEmails: AccountEmailGateway = { sendVerifyEmail: async () => {}, sendPasswordReset: async () => {} };

export const makeSignUpUseCase = (emails: AccountEmailGateway, db: Db = getDb()) =>
  new SignUpUseCase(
    new DrizzleUserGateway(db),
    new DrizzleSessionGateway(db),
    new DrizzleOneTimeTokenGateway(db),
    new ScryptPasswordHasher(),
    uuidIds,
    new RandomTokenGenerator(),
    emails,
    systemClock,
  );

export const makeSignInUseCase = (db: Db = getDb()) =>
  new SignInUseCase(
    new DrizzleUserGateway(db),
    new DrizzleSessionGateway(db),
    new ScryptPasswordHasher(),
    new RandomTokenGenerator(),
    systemClock,
  );

export const makeSignOutUseCase = (db: Db = getDb()) => new SignOutUseCase(new DrizzleSessionGateway(db));

export const makeResolveSessionUseCase = (db: Db = getDb()) =>
  new ResolveSessionUseCase(new DrizzleUserGateway(db), new DrizzleSessionGateway(db), systemClock);

export const makeConfirmEmailUseCase = (db: Db = getDb()) =>
  new ConfirmEmailUseCase(new DrizzleUserGateway(db), new DrizzleOneTimeTokenGateway(db), systemClock);

export const makeResendVerificationUseCase = (emails: AccountEmailGateway, db: Db = getDb()) =>
  new ResendVerificationUseCase(
    new DrizzleUserGateway(db),
    new DrizzleOneTimeTokenGateway(db),
    new RandomTokenGenerator(),
    emails,
    systemClock,
  );

export const makeRequestPasswordResetUseCase = (emails: AccountEmailGateway, db: Db = getDb()) =>
  new RequestPasswordResetUseCase(
    new DrizzleUserGateway(db),
    new DrizzleOneTimeTokenGateway(db),
    new RandomTokenGenerator(),
    emails,
    systemClock,
  );

export const makeResetPasswordUseCase = (db: Db = getDb()) =>
  new ResetPasswordUseCase(
    new DrizzleUserGateway(db),
    new DrizzleSessionGateway(db),
    new DrizzleOneTimeTokenGateway(db),
    new ScryptPasswordHasher(),
    new RandomTokenGenerator(),
    systemClock,
  );

export const makeSignInWithGoogleUseCase = (google: GoogleClient, db: Db = getDb()) =>
  new SignInWithGoogleUseCase(
    new DrizzleUserGateway(db),
    new DrizzleSessionGateway(db),
    new DrizzleOneTimeTokenGateway(db),
    new GoogleOAuthIdentityGateway(google),
    uuidIds,
    new RandomTokenGenerator(),
    systemClock,
  );
