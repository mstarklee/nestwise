import 'server-only';

const NAME = 'nw_session';

/** The session token from the `nw_session` cookie, or from `Authorization: Bearer` (a future native app). */
export function readSessionToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim() || null;
  for (const part of (request.headers.get('cookie') ?? '').split(/;\s*/)) {
    if (part.startsWith(`${NAME}=`)) return decodeURIComponent(part.slice(NAME.length + 1)) || null;
  }
  return null;
}

/** HttpOnly so page scripts cannot read it; Secure; SameSite=Lax; lives as long as the session. */
export function sessionCookie(token: string, expiresAt: Date, now: Date = new Date()): string {
  const maxAge = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 1000));
  return `${NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export const clearedSessionCookie = `${NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
