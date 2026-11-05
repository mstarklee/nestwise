import 'server-only';
import type { SttProvider } from '../../capture/clip-limits';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The key for the chosen speech service.
 *
 * Each service's own name wins (`SARVAM_API_KEY`, `OPENAI_API_KEY`), with the shared `STT_API_KEY` as the fallback.
 * That way the key the owner already pasted under a service's own name is found without copying it a second time,
 * and one service's key can never be sent to the other.
 *
 * Returns an empty string rather than `undefined` when nothing is set, so a missing key fails as an auth error from
 * the service rather than silently sending the text "undefined".
 */
export function speechKeyFor(provider: SttProvider, env: Env): string {
  const own = provider === 'sarvam' ? env.SARVAM_API_KEY : env.OPENAI_API_KEY;
  return (own ?? env.STT_API_KEY ?? '').trim();
}
