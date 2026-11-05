import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { appOrigin } from './app-origin';

/** Where Google sends the person back; also registered on the OAuth client in Google Cloud. */
export const googleRedirectUri = (request: Request) => `${appOrigin(request)}/api/v1/auth/google/callback`;

/** A random state (against forged callbacks) and a PKCE verifier with its S256 challenge. */
export function newGoogleRoundTrip(): { state: string; verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return {
    state: randomBytes(24).toString('base64url'),
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

/** A redirect that can carry several cookies. */
export function redirectWithCookies(location: string, cookies: readonly string[]): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status: 303, headers });
}
