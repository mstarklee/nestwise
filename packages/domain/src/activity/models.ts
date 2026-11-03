import type { Actor } from '../shared';

/** One line of the activity history (PRD §6.9): who changed what, and when. */
export interface ActivityRow {
  readonly id: number;
  readonly actorId: string;
  /** Users have no display names yet, so the screen shows "You" or this address. */
  readonly actorEmail: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly at: Date;
  /** A change to a month that was already closed. */
  readonly lateEdit: boolean;
}

export interface ListActivityCommand {
  readonly actor: Actor;
  /** Rows older than this id (the previous page's nextBefore). */
  readonly before?: number;
  readonly limit: number;
}

export interface ActivityPage {
  readonly rows: readonly ActivityRow[];
  /** Pass as `before` for the next page; null when there are no more. */
  readonly nextBefore: number | null;
}

export const MAX_ACTIVITY_PAGE = 50;
