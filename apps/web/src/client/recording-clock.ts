/**
 * When a recording should stop, and how long it has been going. All of the timing rules live here, away from the
 * microphone plumbing, so they can be tested without a browser.
 *
 * Two things end a recording on their own: the service's clip limit (`maxClipSeconds`), and a stretch of silence
 * once the person has actually said something. The second condition matters — without it, the pause between tapping
 * and starting to speak would cut the recording off before a word was in it.
 */
export type StopReason = 'tapped' | 'limit' | 'silence';

/** Below this, the microphone is treated as quiet. Low enough to ignore room noise, high enough to catch speech. */
export const SILENCE_FLOOR = 0.02;

export class RecordingClock {
  private startedAt: number | null = null;
  private lastSpokeAt: number | null = null;
  private stopped = false;

  constructor(
    private readonly maxSeconds: number,
    private readonly silenceMs: number,
    private readonly silenceFloor = SILENCE_FLOOR,
  ) {}

  start(atMs: number): void {
    this.startedAt = atMs;
    this.lastSpokeAt = null;
    this.stopped = false;
  }

  /**
   * Feeds one level reading. Returns the reason to stop, or null to carry on. The limit is checked first, so a
   * recording that reaches the limit in silence is reported as hitting the limit rather than trailing off.
   */
  sample(atMs: number, level: number): StopReason | null {
    if (this.startedAt === null || this.stopped) return null;

    if (atMs - this.startedAt >= this.maxSeconds * 1000) {
      this.stopped = true;
      return 'limit';
    }

    if (level > this.silenceFloor) {
      this.lastSpokeAt = atMs;
      return null;
    }

    // Quiet, but only meaningful once there has been something to be quiet after.
    if (this.lastSpokeAt !== null && atMs - this.lastSpokeAt >= this.silenceMs) {
      this.stopped = true;
      return 'silence';
    }

    return null;
  }

  /** Whole seconds since the tap, for the timer on screen. */
  elapsedSeconds(atMs: number): number {
    if (this.startedAt === null) return 0;
    return Math.round((atMs - this.startedAt) / 1000);
  }

  /** True once something has been said, so the screen can stop saying "go ahead". */
  get heardSomething(): boolean {
    return this.lastSpokeAt !== null;
  }
}
