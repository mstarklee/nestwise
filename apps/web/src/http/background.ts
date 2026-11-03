import 'server-only';
import { waitUntil } from '@vercel/functions';

const pending = new Set<Promise<void>>();

/**
 * Work that should finish after the response (spending alerts): Vercel keeps the function alive for it, and a
 * failure is logged, never shown to the person who saved.
 */
export function runInBackground(label: string, work: Promise<unknown>): void {
  const tracked: Promise<void> = work
    .then(() => undefined)
    .catch((error: unknown) => console.error(`${label} failed`, error))
    .finally(() => pending.delete(tracked));
  pending.add(tracked);
  waitUntil(tracked);
}

/** Waits for background work started in this process (tests settle it before emptying the database). */
export async function settleBackground(): Promise<void> {
  while (pending.size > 0) await Promise.all([...pending]);
}
