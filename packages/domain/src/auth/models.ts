import { InvalidAuthCommandError } from './errors';

export const SESSION_DAYS = 180;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface User {
  readonly id: string;
  /** Lower-case and trimmed; unique. */
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
}

export interface NewSession {
  /** The raw token goes to the browser only; the adapter stores a hash of it. */
  readonly token: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface SignUpCommand {
  readonly email: string;
  readonly password: string;
}

export type SignInCommand = SignUpCommand;

export interface SignOutCommand {
  readonly token: string;
}

export interface ResolveSessionCommand {
  readonly token: string | null;
}

export interface SignedIn {
  readonly user: { readonly id: string; readonly email: string };
  readonly token: string;
  readonly expiresAt: Date;
}

export interface SessionUser {
  readonly userId: string;
  readonly email: string;
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
