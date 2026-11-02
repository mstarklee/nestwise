import type { ActivityEvent, ActivityGateway } from '../../src/shared';

export class InMemoryActivityGateway implements ActivityGateway {
  private events: ActivityEvent[] = [];

  async record(event: ActivityEvent): Promise<void> {
    this.events.push(event);
  }

  all(): readonly ActivityEvent[] {
    return [...this.events];
  }

  count(): number {
    return this.events.length;
  }

  /** For unit-of-work fakes: take and restore a snapshot. */
  snapshot(): ActivityEvent[] {
    return [...this.events];
  }

  restore(events: ActivityEvent[]): void {
    this.events = [...events];
  }
}

/** Wraps the fake so a unit-of-work test can make the activity write fail and prove the rollback. */
export class FailingActivityGateway implements ActivityGateway {
  constructor(
    private readonly inner: InMemoryActivityGateway,
    private readonly shouldFail: () => boolean,
  ) {}
  async record(event: ActivityEvent) {
    if (this.shouldFail()) throw new Error('activity write failed');
    await this.inner.record(event);
  }
}
