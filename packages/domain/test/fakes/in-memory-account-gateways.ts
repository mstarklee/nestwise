import {
  type AccountEmailGateway,
  type GoogleIdentity,
  type GoogleIdentityGateway,
  GoogleSignInFailedError,
  type NewOneTimeToken,
  type OneTimeTokenGateway,
  type OneTimeTokenPurpose,
} from '../../src/auth';

interface StoredToken extends NewOneTimeToken {
  usedAt: Date | null;
  revoked: boolean;
}

export class InMemoryOneTimeTokenGateway implements OneTimeTokenGateway {
  private tokens: StoredToken[] = [];

  async create(token: NewOneTimeToken): Promise<void> {
    this.tokens.push({ ...token, usedAt: null, revoked: false });
  }

  async consume(token: string, purpose: OneTimeTokenPurpose, now: Date): Promise<string | undefined> {
    const found = this.tokens.find((t) => t.token === token && t.purpose === purpose && !t.usedAt && !t.revoked && t.expiresAt > now);
    if (!found) return undefined;
    found.usedAt = now;
    return found.userId;
  }

  async revokeAll(userId: string, purpose: OneTimeTokenPurpose): Promise<void> {
    for (const t of this.tokens) if (t.userId === userId && t.purpose === purpose && !t.usedAt) t.revoked = true;
  }

  async latestCreatedAt(userId: string, purpose: OneTimeTokenPurpose): Promise<Date | undefined> {
    const times = this.tokens.filter((t) => t.userId === userId && t.purpose === purpose).map((t) => t.createdAt.getTime());
    return times.length ? new Date(Math.max(...times)) : undefined;
  }

  all(): readonly StoredToken[] {
    return this.tokens;
  }
}

export interface SentAccountEmail {
  readonly kind: 'verify' | 'reset';
  readonly to: string;
  readonly token: string;
  readonly returnTo?: string;
}

export class RecordingAccountEmailGateway implements AccountEmailGateway {
  readonly sent: SentAccountEmail[] = [];

  async sendVerifyEmail(to: string, token: string, returnTo?: string): Promise<void> {
    this.sent.push({ kind: 'verify', to, token, ...(returnTo ? { returnTo } : {}) });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    this.sent.push({ kind: 'reset', to, token });
  }

  last(): SentAccountEmail | undefined {
    return this.sent.at(-1);
  }
}

/** Google stand-in: a code maps to an identity, but only with the matching PKCE verifier. */
export class FakeGoogleIdentityGateway implements GoogleIdentityGateway {
  private readonly codes = new Map<string, { verifier: string; identity: GoogleIdentity }>();

  willAccept(code: string, verifier: string, identity: GoogleIdentity): void {
    this.codes.set(code, { verifier, identity });
  }

  async identityFor(code: string, codeVerifier: string): Promise<GoogleIdentity> {
    const entry = this.codes.get(code);
    if (!entry || entry.verifier !== codeVerifier) throw new GoogleSignInFailedError('Google did not accept the sign-in');
    this.codes.delete(code);
    return entry.identity;
  }
}
