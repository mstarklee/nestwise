import 'server-only';
import { connection } from 'next/server';

/**
 * Marks a GET handler as per-request, so Next.js (Cache Components) never runs it at build time — which would
 * also query the database during every build. Outside a Next.js request (route tests call handlers directly) there
 * is nothing to mark, so that one error is ignored; every other error, including Next's own prerender signals,
 * propagates.
 */
export async function perRequest(): Promise<void> {
  try {
    await connection();
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside a request scope')) return;
    throw error;
  }
}
