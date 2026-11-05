import { EmailNotVerifiedError, InvalidAuthCommandError } from './errors';

export const SESSION_DAYS = 180;
/** How long a "Verify my email" link works. */
export const VERIFY_EMAIL_HOURS = 24;
/** How long a password reset link works (once). */
export const RESET_PASSWORD_MINUTES = 60;
/** At most one verify or reset email per account in this many seconds. */
export const EMAIL_RESEND_SECONDS = 60;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface User {
  readonly id: string;
  /** Lower-case and trimmed; unique. */
  readonly email: string;
  /** Null for an account that only signs in with Google (it can add a password through "forgot password"). */
  readonly passwordHash: string | null;
  /** When the person proved they own the email (the verify link, a password reset, or Google). */
  readonly emailVerifiedAt: Date | null;
  /** Google's stable account id ("sub"), once the account has signed in with Google. */
  readonly googleSubject: string | null;
  readonly createdAt: Date;
}

export interface NewSession {
  /** The raw token goes to the browser only; the adapter stores a hash of it. */
  readonly token: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

/** What a one-time emailed link is for. */
export type OneTimeTokenPurpose = 'verify_email' | 'reset_password';

export interface NewOneTimeToken {
  /** The raw token goes into the emailed link only; the adapter stores a hash of it. */
  readonly token: string;
  readonly userId: string;
  readonly purpose: OneTimeTokenPurpose;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/** What Google says about the person after they agreed on Google's screen. */
export interface GoogleIdentity {
  /** Google's stable account id ("sub"). */
  readonly subject: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

export interface SignUpCommand {
  readonly email: string;
  readonly password: string;
  /** Where the verify link should take them afterwards (an app path such as /join/abc). */
  readonly returnTo?: string;
}

export interface SignInCommand {
  readonly email: string;
  readonly password: string;
}

export interface SignOutCommand {
  readonly token: string;
}

export interface ResolveSessionCommand {
  readonly token: string | null;
}

export interface ConfirmEmailCommand {
  readonly token: string;
}

export interface ResendVerificationCommand {
  readonly userId: string;
  readonly returnTo?: string;
}

export interface RequestPasswordResetCommand {
  readonly email: string;
}

export interface ResetPasswordCommand {
  readonly token: string;
  readonly password: string;
}

export interface SignInWithGoogleCommand {
  /** The one-time code Google sent back to our callback. */
  readonly code: string;
  /** The PKCE verifier kept in the browser's short-lived cookie. */
  readonly codeVerifier: string;
}

export type ResendVerificationResult = 'sent' | 'too_soon' | 'already_verified';

export interface SignedIn {
  readonly user: { readonly id: string; readonly email: string; readonly emailVerified: boolean };
  readonly token: string;
  readonly expiresAt: Date;
}

export interface SessionUser {
  readonly userId: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

export function normaliseEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) throw new InvalidAuthCommandError('Enter a valid email address');
  return email;
}

export function assertPasswordAcceptable(password: string): void {
  if (password.length < MIN_PASSWORD) throw new InvalidAuthCommandError(`Use a password of at least ${MIN_PASSWORD} characters`);
  if (password.length > MAX_PASSWORD) throw new InvalidAuthCommandError('That password is too long');
}

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export function oneTimeTokenExpiry(purpose: OneTimeTokenPurpose, now: Date): Date {
  const ms = purpose === 'verify_email' ? VERIFY_EMAIL_HOURS * 60 * 60 * 1000 : RESET_PASSWORD_MINUTES * 60 * 1000;
  return new Date(now.getTime() + ms);
}

/** The app may be used only once the email is proved. */
export function assertEmailVerified(user: SessionUser): void {
  if (!user.emailVerified) throw new EmailNotVerifiedError('Please verify your email first');
}

/** An in-app path to go to afterwards, or undefined: never another site ("//evil.example", "https://…", "/\\…"). */
export function safeReturnTo(path: string | null | undefined): string | undefined {
  if (!path || path.length > 500) return undefined;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return undefined;
  return path;
}

export const isEmailVerified = (user: User): boolean => user.emailVerifiedAt !== null;
