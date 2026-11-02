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

/** Secure everywhere except plain-http localhost, where browsers (WebKit) would drop a Secure cookie in local tests. */
function secureFlag(request: Request): string {
  const url = new URL(request.url);
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  return local ? '' : ' Secure;';
}

/** HttpOnly so page scripts cannot read it; Secure; SameSite=Lax; lives as long as the session. */
export function sessionCookie(request: Request, token: string, expiresAt: Date, now: Date = new Date()): string {
  const maxAge = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 1000));
  return `${NAME}=${token}; Path=/; HttpOnly;${secureFlag(request)} SameSite=Lax; Max-Age=${maxAge}`;
}

export const clearedSessionCookie = (request: Request) => `${NAME}=; Path=/; HttpOnly;${secureFlag(request)} SameSite=Lax; Max-Age=0`;
