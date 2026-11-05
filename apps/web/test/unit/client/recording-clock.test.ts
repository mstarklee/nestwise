import { beforeEach, describe, expect, it } from 'vitest';
import { RecordingClock, SILENCE_FLOOR } from '@/client/recording-clock';

const LOUD = 0.4;
const QUIET = SILENCE_FLOOR / 2;
const MAX = 30;
const SILENCE_MS = 2500;

describe('RecordingClock', () => {
  let clock: RecordingClock;

  beforeEach(() => {
    clock = new RecordingClock(MAX, SILENCE_MS);
    clock.start(1000);
  });

  it('does not stop the moment it starts', () => {
    expect(clock.sample(1000, QUIET)).toBeNull();
  });

  it('does not stop on silence before anything has been said', () => {
    // The person taps, then takes a breath. Ten seconds of quiet must not end the recording.
    for (let at = 1000; at <= 11_000; at += 250) expect(clock.sample(at, QUIET)).toBeNull();
  });

  it('stops after the silence window once speech has been heard', () => {
    clock.sample(2000, LOUD);
    expect(clock.sample(2000 + SILENCE_MS - 1, QUIET)).toBeNull();
    expect(clock.sample(2000 + SILENCE_MS, QUIET)).toBe('silence');
  });

  it('starts the silence window again every time speech returns', () => {
    clock.sample(2000, LOUD);
    expect(clock.sample(4000, QUIET)).toBeNull();
    clock.sample(4100, LOUD); // they carried on talking
    expect(clock.sample(4100 + SILENCE_MS - 1, QUIET)).toBeNull();
    expect(clock.sample(4100 + SILENCE_MS, QUIET)).toBe('silence');
  });

  it('stops at the limit', () => {
    expect(clock.sample(1000 + MAX * 1000 - 1, LOUD)).toBeNull();
    expect(clock.sample(1000 + MAX * 1000, LOUD)).toBe('limit');
  });

  it('stops at the limit even while someone is still talking', () => {
    for (let at = 1000; at < 1000 + MAX * 1000; at += 250) clock.sample(at, LOUD);
    expect(clock.sample(1000 + MAX * 1000, LOUD)).toBe('limit');
  });

  it('reports the limit, not silence, when both would fire at once', () => {
    clock.sample(2000, LOUD);
    expect(clock.sample(1000 + MAX * 1000, QUIET)).toBe('limit');
  });

  it('counts the seconds elapsed, for the timer on screen', () => {
    expect(clock.elapsedSeconds(1000)).toBe(0);
    expect(clock.elapsedSeconds(8400)).toBe(7);
    expect(clock.elapsedSeconds(8600)).toBe(8);
  });

  it('treats the limit as reached when the clock jumps, as it does when the phone sleeps', () => {
    expect(clock.sample(1000 + 10 * 60 * 1000, LOUD)).toBe('limit');
  });

  it('says nothing more once it has already stopped', () => {
    clock.sample(2000, LOUD);
    expect(clock.sample(2000 + SILENCE_MS, QUIET)).toBe('silence');
    expect(clock.sample(2000 + SILENCE_MS + 500, QUIET)).toBeNull();
    expect(clock.sample(1000 + MAX * 1000, LOUD)).toBeNull();
  });

  it('a 60-second limit lets a minute through', () => {
    const minute = new RecordingClock(60, SILENCE_MS);
    minute.start(0);
    expect(minute.sample(59_000, LOUD)).toBeNull();
    expect(minute.sample(60_000, LOUD)).toBe('limit');
  });
});
