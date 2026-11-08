'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ApiError, API_OK } from '@/client/api-client';
import { MicrophoneUnavailableError, type Recording, startRecording } from '@/client/microphone';
import { RecordingClock, type StopReason } from '@/client/recording-clock';
import { useErrorText } from '@/components/use-error-text';

/** Silence long enough to mean "they have finished", short enough not to feel like a hang. */
const SILENCE_MS = 2500;

/** ready → starting (asking for the microphone) → recording → sending (then the check page opens). */
export type VoicePhase = 'ready' | 'starting' | 'recording' | 'sending';

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/** Whether the phone has a signal; voice needs one (design §2). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * One voice note (PRD §6.11): `begin()` opens the microphone and records; it stops on `finish()`, at the clip limit,
 * or after a stretch of silence, then uploads and opens the check page. `cancel()` stops and throws the recording
 * away. Shared by the Speak pop-up and the /capture page.
 *
 * Call `begin()` straight from a tap: iPhone only lets a page use the microphone and audio from a user gesture.
 */
export function useVoiceRecorder(maxSeconds: number) {
  const t = useTranslations('voice');
  const errorText = useErrorText();
  const router = useRouter();

  const [phase, setPhase] = useState<VoicePhase>('ready');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recording = useRef<Recording | null>(null);
  const clock = useRef<RecordingClock | null>(null);
  const frame = useRef<number | null>(null);
  /** Bumped by cancel(), so a microphone that opens after the person cancelled is closed again at once. */
  const attempt = useRef(0);

  const stopWatching = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const send = useCallback(
    async (reason: StopReason) => {
      const active = recording.current;
      recording.current = null;
      stopWatching();
      if (!active) return;

      setPhase('sending');
      try {
        const { blob, mimeType } = await active.stop();
        const elapsed = clock.current?.elapsedSeconds(performance.now()) ?? 0;
        if (blob.size === 0) throw new ApiError(422, 'CaptureNotUnderstoodError', t('nothingHeard'));

        const form = new FormData();
        form.set('audio', blob, `voice.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`);
        form.set('seconds', String(reason === 'limit' ? maxSeconds : elapsed));

        const response = await fetch('/api/v1/capture/voice', { method: 'POST', credentials: 'same-origin', body: form });
        const json = (await response.json().catch(() => ({}))) as { batch?: { id: string }; error?: { code?: string; message?: string } };
        if (!response.ok || !json.batch) {
          throw new ApiError(response.status, json.error?.code ?? 'ServerError', json.error?.message ?? '');
        }
        window.dispatchEvent(new Event(API_OK));
        router.push(`/capture/${json.batch.id}`);
      } catch (e) {
        setError(errorText(e));
        setPhase('ready');
        setSeconds(0);
        setLevel(0);
      }
    },
    [errorText, maxSeconds, router, stopWatching, t],
  );

  const watch = useCallback(() => {
    const active = recording.current;
    const timing = clock.current;
    if (!active || !timing) return;

    const now = performance.now();
    const loudness = active.level();
    setLevel(loudness);
    setSeconds(timing.elapsedSeconds(now));

    const reason = timing.sample(now, loudness);
    if (reason) {
      void send(reason);
      return;
    }
    frame.current = requestAnimationFrame(watch);
  }, [send]);

  const begin = useCallback(async () => {
    const mine = ++attempt.current;
    setError(null);
    setPhase('starting');
    setSeconds(0);
    setLevel(0);
    try {
      const active = await startRecording();
      if (mine !== attempt.current) {
        void active.stop(); // cancelled while the microphone was opening
        return;
      }
      recording.current = active;
      const timing = new RecordingClock(maxSeconds, SILENCE_MS);
      timing.start(performance.now());
      clock.current = timing;
      setPhase('recording');
      frame.current = requestAnimationFrame(watch);
    } catch (e) {
      if (mine !== attempt.current) return;
      setError(e instanceof MicrophoneUnavailableError ? t('noMic') : errorText(e));
      setPhase('ready');
    }
  }, [errorText, maxSeconds, t, watch]);

  const finish = useCallback(() => void send('tapped'), [send]);

  const cancel = useCallback(() => {
    attempt.current += 1;
    const active = recording.current;
    recording.current = null;
    stopWatching();
    void active?.stop();
    setPhase('ready');
    setSeconds(0);
    setLevel(0);
    setError(null);
  }, [stopWatching]);

  useEffect(
    () => () => {
      attempt.current += 1;
      stopWatching();
      void recording.current?.stop();
    },
    [stopWatching],
  );

  return { phase, seconds, level, error, begin, finish, cancel };
}
