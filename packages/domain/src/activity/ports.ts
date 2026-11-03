import type { ActivityRow } from './models';

/** Reads the family's activity history, newest first (keyset paging on id). */
export interface ActivityReader {
  list(familyId: string, page: { readonly before?: number; readonly limit: number }): Promise<readonly ActivityRow[]>;
}
