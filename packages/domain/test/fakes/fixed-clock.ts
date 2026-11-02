import type { Clock } from '../../src/shared';

export class FixedClock implements Clock {
  private instant: number;

  constructor(isoInstant: string) {
    this.instant = new Date(isoInstant).getTime();
  }

  now(): Date {
    return new Date(this.instant);
  }

  set(isoInstant: string): void {
    this.instant = new Date(isoInstant).getTime();
  }
}
