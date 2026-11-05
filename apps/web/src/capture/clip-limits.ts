/**
 * How long one recording may be. Deliberately NOT inside the adapters: the limit has to be known by the browser
 * before it starts recording and by the route before it calls out, and neither of those can read a duration out of
 * raw audio bytes. So it lives here, with no `server-only`, and both sides import the same number.
 *
 * Sarvam's quick endpoint stops at half a minute (design §7, as amended by the plan's opening note); OpenAI takes a
 * minute comfortably.
 */
export type SttProvider = 'openai' | 'sarvam';

const LIMITS: Record<SttProvider, number> = { openai: 60, sarvam: 30 };

export function maxClipSeconds(provider: SttProvider): number {
  return LIMITS[provider];
}

export function readProvider(value: string | undefined): SttProvider {
  return value === 'sarvam' ? 'sarvam' : 'openai';
}
