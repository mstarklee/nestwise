import { safeReturnTo } from '@nestwise/domain/auth';
import { googleAuthorizeUrl, googleClient } from '@/adapters/auth/google-oauth-identity-gateway';
import { googleRedirectUri, newGoogleRoundTrip, redirectWithCookies } from '@/http/google-flow';
import { perRequest } from '@/http/per-request';
import { googleRoundTripCookie } from '@/http/session-cookie';

/** "Continue with Google": off to Google's screen, remembering the state, the PKCE verifier and ?next= in a short cookie. */
export async function GET(request: Request): Promise<Response> {
  await perRequest();
  const url = new URL(request.url);
  const next = safeReturnTo(url.searchParams.get('next')) ?? '/home';
  const client = googleClient(googleRedirectUri(request));
  if (!client) return redirectWithCookies('/sign-in?error=google_unavailable', []);

  const trip = newGoogleRoundTrip();
  return redirectWithCookies(googleAuthorizeUrl(client, trip.state, trip.challenge), [
    googleRoundTripCookie(request, { state: trip.state, verifier: trip.verifier, next }),
  ]);
}
