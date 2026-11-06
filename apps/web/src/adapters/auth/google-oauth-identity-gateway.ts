import 'server-only';
import { type GoogleIdentity, type GoogleIdentityGateway, GoogleSignInFailedError } from '@nestwise/domain/auth';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export interface GoogleClient {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Must match one of the redirect URIs set on the OAuth client in Google Cloud. */
  readonly redirectUri: string;
}

/** GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or undefined when Google sign-in is not set up. */
export function googleClient(redirectUri: string, env: Readonly<Record<string, string | undefined>> = process.env): GoogleClient | undefined {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret, redirectUri } : undefined;
}

/** Google's consent screen: OAuth 2.0 code flow with PKCE (S256), asking only for name and email. */
export function googleAuthorizeUrl(client: GoogleClient, state: string, codeChallenge: string): string {
  const query = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${AUTHORIZE_URL}?${query.toString()}`;
}

type Fetch = typeof fetch;

/**
 * Swaps Google's one-time code for the person's identity. The ID token comes straight from Google's token endpoint
 * over TLS, so its signature need not be checked (OpenID Connect Core §3.1.3.7); its issuer, audience and expiry are.
 */
export class GoogleOAuthIdentityGateway implements GoogleIdentityGateway {
  constructor(
    private readonly client: GoogleClient,
    private readonly fetchFn: Fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async identityFor(code: string, codeVerifier: string): Promise<GoogleIdentity> {
    let response: Response;
    try {
      response = await this.fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          code_verifier: codeVerifier,
          client_id: this.client.clientId,
          client_secret: this.client.clientSecret,
          redirect_uri: this.client.redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new GoogleSignInFailedError('Could not reach Google', { cause: error });
    }
    const body = (await response.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
    if (!response.ok || typeof body.id_token !== 'string') {
      throw new GoogleSignInFailedError(`Google refused the sign-in (${typeof body.error === 'string' ? body.error : response.status})`);
    }
    return this.identityFrom(body.id_token);
  }

  private identityFrom(idToken: string): GoogleIdentity {
    const payload = decodePayload(idToken);
    const nowSeconds = this.now().getTime() / 1000;
    if (!payload || !ISSUERS.has(String(payload.iss)) || payload.aud !== this.client.clientId) {
      throw new GoogleSignInFailedError('Google sent an ID token that is not for NestWise');
    }
    if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) throw new GoogleSignInFailedError('Google sent an expired ID token');
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string') {
      throw new GoogleSignInFailedError('Google did not share an email');
    }
    return { subject: payload.sub, email: payload.email, emailVerified: payload.email_verified === true || payload.email_verified === 'true' };
  }
}

function decodePayload(jwt: string): Record<string, unknown> | undefined {
  const part = jwt.split('.')[1];
  if (!part) return undefined;
  try {
    const value: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
