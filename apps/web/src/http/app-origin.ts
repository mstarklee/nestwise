import 'server-only';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The app's own address, for links in emails and the Google redirect. APP_URL wins. Without it, outside production,
 * the request's own origin is used (local work on http://localhost:3000). In production APP_URL is required: an
 * address taken from the request could be forged, and a reset link must never point anywhere else.
 */
export function appOrigin(request: Request, env: Env = process.env): string {
  const configured = env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') throw new Error('APP_URL is not set');
  return new URL(request.url).origin;
}
