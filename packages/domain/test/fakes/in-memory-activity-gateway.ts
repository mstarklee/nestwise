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
