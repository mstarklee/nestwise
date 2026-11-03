export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

/** One append-only history row: who changed what, with before and after. */
export interface ActivityEvent {
  readonly familyId: string;
  readonly actorId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly at: Date;
  /** A change to a month that was already closed (PRD §6.3); shown as late in the activity history. */
  readonly lateEdit?: boolean;
}

export interface ActivityGateway {
  record(event: ActivityEvent): Promise<void>;
}
