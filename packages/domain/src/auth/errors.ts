import { DomainError } from '../shared';

export abstract class AuthError extends DomainError {}

export class InvalidAuthCommandError extends AuthError {
  readonly category = 'invalid' as const;
}

export class EmailAlreadyRegisteredError extends AuthError {
  readonly category = 'conflict' as const;
}

/** Wrong email or password: deliberately the same answer for both. */
export class InvalidCredentialsError extends AuthError {
  readonly category = 'not_signed_in' as const;
}

export class NotSignedInError extends AuthError {
  readonly category = 'not_signed_in' as const;
}

/** Signed in, but the email is not proved yet: the app waits for the verify link. */
export class EmailNotVerifiedError extends AuthError {
  readonly category = 'not_allowed' as const;
}

/** A verify or reset link that is unknown, already used, replaced by a newer one, or expired. */
export class InvalidAuthLinkError extends AuthError {
  readonly category = 'invalid' as const;
}

/** Google did not give us a usable, verified identity (a stale code, a refused screen, an unverified email). */
export class GoogleSignInFailedError extends AuthError {
  readonly category = 'invalid' as const;
}

/** The account with this email is already joined to a different Google account. */
export class GoogleAccountConflictError extends AuthError {
  readonly category = 'conflict' as const;
}
