import type { GoogleIdentity, NewOneTimeToken, NewSession, OneTimeTokenPurpose, User } from './models';

export interface UserGateway {
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  findByGoogleSubject(subject: string): Promise<User | undefined>;
  /** A new account. Throws EmailAlreadyRegisteredError if the email is taken (the database's unique index is the real guard). */
  save(user: User): Promise<User>;
  /** Changes an existing account (password, verification, Google link). */
  update(user: User): Promise<User>;
}

export interface SessionGateway {
  create(session: NewSession): Promise<void>;
  /** The user of a session that has not expired at `now`. */
  findUserId(token: string, now: Date): Promise<string | undefined>;
  delete(token: string): Promise<void>;
  /** Signs the account out everywhere. */
  deleteAllForUser(userId: string): Promise<void>;
}

/** Single-use tokens for emailed links. Only a hash is stored. */
export interface OneTimeTokenGateway {
  create(token: NewOneTimeToken): Promise<void>;
  /**
   * Uses up a live token of that purpose and returns its user, or undefined when it is unknown, already used, revoked,
   * expired at `now`, or for another purpose. Atomic: two uses of the same token never both succeed.
   */
  consume(token: string, purpose: OneTimeTokenPurpose, now: Date): Promise<string | undefined>;
  /** Makes every unused token of that purpose for the user stop working. */
  revokeAll(userId: string, purpose: OneTimeTokenPurpose): Promise<void>;
  /** When the newest token of that purpose was made for the user (to space out emails). */
  latestCreatedAt(userId: string, purpose: OneTimeTokenPurpose): Promise<Date | undefined>;
}

/** The account emails. The adapter builds the links and words; it never throws (a failure is logged, and the person can resend). */
export interface AccountEmailGateway {
  sendVerifyEmail(to: string, token: string, returnTo?: string): Promise<void>;
  sendPasswordReset(to: string, token: string): Promise<void>;
}

/** Swaps Google's one-time code for who the person is. Throws GoogleSignInFailedError when Google refuses. */
export interface GoogleIdentityGateway {
  identityFor(code: string, codeVerifier: string): Promise<GoogleIdentity>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** Compares in constant time; with no hash it still does the work, so timing does not reveal unknown emails. */
  verify(password: string, hash: string | undefined): Promise<boolean>;
}

/** Unguessable session tokens. */
export interface TokenGenerator {
  next(): string;
}
