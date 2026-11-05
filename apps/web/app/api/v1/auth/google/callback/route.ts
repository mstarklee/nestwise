import { timingSafeEqual } from 'node:crypto';
import { GoogleAccountConflictError, safeReturnTo } from '@nestwise/domain/auth';
import { DomainError } from '@nestwise/domain/shared';
import { googleClient } from '@/adapters/auth/google-oauth-identity-gateway';
import { makeSignInWithGoogleUseCase } from '@/composition/auth';
import { googleRedirectUri, redirectWithCookies } from '@/http/google-flow';
import { perRequest } from '@/http/per-request';
import { clearedGoogleRoundTripCookie, readGoogleRoundTrip, sessionCookie } from '@/http/session-cookie';

const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Google sends the person back here with a one-time code. Checks the state, signs in, and goes on to ?next=. */
export async function GET(request: Request): Promise<Response> {
  await perRequest();
  const url = new URL(request.url);
  const cleared = clearedGoogleRoundTripCookie(request);
  const fail = (reason: string) => redirectWithCookies(`/sign-in?error=${reason}`, [cleared]);

  const trip = readGoogleRoundTrip(request);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  if (url.searchParams.get('error')) return fail('google_cancelled'); // they said no on Google's screen
  if (!trip || !code || !sameText(state, trip.state)) return fail('google');

  const client = googleClient(googleRedirectUri(request));
  if (!client) return fail('google_unavailable');
  try {
    const signedIn = await makeSignInWithGoogleUseCase(client).execute({ code, codeVerifier: trip.verifier });
    return redirectWithCookies(safeReturnTo(trip.next) ?? '/home', [cleared, sessionCookie(request, signedIn.token, signedIn.expiresAt)]);
  } catch (error) {
    if (error instanceof GoogleAccountConflictError) return fail('google_conflict');
    if (error instanceof DomainError) return fail('google');
    console.error('Google sign-in failed', error instanceof Error ? error.message : 'unknown error');
    return fail('google');
  }
}
