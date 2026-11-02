import 'server-only';
import type { SessionUser } from '@nestwise/domain/auth';
import type { Actor } from '@nestwise/domain/shared';
import { makeResolveSessionUseCase } from '../composition/auth';
import { makeResolveActorUseCase } from '../composition/family';
import { readSessionToken } from './session-cookie';

/** The signed-in user (cookie or Bearer token), or NotSignedInError (401). */
export function requireSessionUser(request: Request): Promise<SessionUser> {
  return makeResolveSessionUseCase().execute({ token: readSessionToken(request) });
}

/**
 * The one gate in front of family data: session → membership → Actor { userId, familyId, role }.
 * 401 without a session; 403 (NotAMemberError) for a user with no live membership.
 */
export async function requireActor(request: Request): Promise<Actor> {
  const user = await requireSessionUser(request);
  return makeResolveActorUseCase().execute({ userId: user.userId });
}
