import 'server-only';
import { assertEmailVerified, type SessionUser } from '@nestwise/domain/auth';
import type { Actor } from '@nestwise/domain/shared';
import { makeResolveSessionUseCase } from '../composition/auth';
import { makeResolveActorUseCase } from '../composition/family';
import { readSessionToken } from './session-cookie';

/** The signed-in user (cookie or Bearer token), verified or not, or NotSignedInError (401). Only for account routes. */
export function requireSignedIn(request: Request): Promise<SessionUser> {
  return makeResolveSessionUseCase().execute({ token: readSessionToken(request) });
}

/** The signed-in user with a verified email: 401 without a session, 403 (EmailNotVerifiedError) before the verify link. */
export async function requireSessionUser(request: Request): Promise<SessionUser> {
  const user = await requireSignedIn(request);
  assertEmailVerified(user);
  return user;
}

/**
 * The one gate in front of family data: session → verified email → membership → Actor { userId, familyId, role }.
 * 401 without a session; 403 before the email is verified, or for a user with no live membership (NotAMemberError).
 */
export async function requireActor(request: Request): Promise<Actor> {
  const user = await requireSessionUser(request);
  return makeResolveActorUseCase().execute({ userId: user.userId });
}
