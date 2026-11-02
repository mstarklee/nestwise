import 'server-only';
import type { Clock } from '@nestwise/domain/shared';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The real time. Browser tests run the dev server with NESTWISE_FIXED_NOW so "today" is pinned; that setting is
 * ignored in production (NODE_ENV or VERCEL_ENV production), so it can never move a real family's dates.
 */
export function clockFrom(env: Env): Clock {
  const fixed = env.NESTWISE_FIXED_NOW;
  const production = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
  if (!fixed || production) return { now: () => new Date() };
  const instant = new Date(fixed).getTime();
  if (Number.isNaN(instant)) throw new Error('NESTWISE_FIXED_NOW is not a valid date-time');
  return { now: () => new Date(instant) };
}

export const systemClock: Clock = clockFrom(process.env);
