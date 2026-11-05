'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ApiError, API_OK } from '@/client/api-client';
import { MicrophoneUnavailableError, type Recording, startRecording } from '@/client/microphone';
import { RecordingClock, type StopReason } from '@/client/recording-clock';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useErrorText } from '@/components/use-error-text';

/** Silence long enough to mean "they have finished", short enough not to feel like a hang. */
const SILENCE_MS = 2500;

type Phase = 'ready' | 'recording' | 'sending';

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/**
 * Tap to start, tap to stop (PRD §6.11). It also stops itself at the clip limit and after a stretch of silence, so
 * a forgotten recording cannot run on.
 *
 * Voice needs a signal: with none, this offers typing instead rather than storing recordings for later (design §2).
 */
export function VoiceCapture({ maxSeconds }: { maxSeconds: number }) {
  const t = useTranslations('voice');
  const errorText = useErrorText();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('ready');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recording = useRef<Recording | null>(null);
  const clock = useRef<RecordingClock | null>(null);
  const frame = useRef<number | null>(null);

  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  const send = useCallback(
    async (reason: StopReason) => {
      const active = recording.current;
      recording.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
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
    [errorText, maxSeconds, router, t],
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

  async function begin() {
    setError(null);
    try {
      const active = await startRecording();
      recording.current = active;
      const timing = new RecordingClock(maxSeconds, SILENCE_MS);
      timing.start(performance.now());
      clock.current = timing;
      setPhase('recording');
      setSeconds(0);
      frame.current = requestAnimationFrame(watch);
    } catch (e) {
      setError(e instanceof MicrophoneUnavailableError ? t('noMic') : errorText(e));
    }
  }

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      void recording.current?.stop();
    },
    [],
  );

  if (!online) {
    return (
      <Card className="space-y-3" data-testid="voice-offline">
        <p className="text-[15px]">{t('needsSignal')}</p>
        <Button onClick={() => router.push('/add')}>{t('typeInstead')}</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {phase === 'ready' && (
        <Card className="flex flex-col items-center space-y-4 py-6 text-center">
          <p className="text-[15px]">{t('explain', { seconds: maxSeconds })}</p>
          <button
            type="button"
            onClick={begin}
            data-testid="voice-start"
            className="grid size-32 place-items-center rounded-full bg-rani text-white shadow-card transition-transform active:scale-[.97] motion-reduce:transform-none"
          >
            <span className="grid justify-items-center gap-1 text-[15px] font-bold">
              <Icon name="mic" className="size-10" />
              {t('start')}
            </span>
          </button>
          <p className="max-w-xs text-[13.5px] text-muted">{t('example')}</p>
        </Card>
      )}

      {phase === 'recording' && (
        <Card className="flex flex-col items-center space-y-4 py-6 text-center">
          <p role="status" className="text-[15px] font-semibold">
            {t('listening')}
          </p>
          <p className="money text-[40px] font-extrabold leading-none" data-testid="voice-timer">
            0:{String(Math.min(seconds, maxSeconds)).padStart(2, '0')}
          </p>
          <div className="relative grid size-32 place-items-center">
            <span aria-hidden="true" className="animate-pulse-ring absolute inset-0 rounded-full bg-rani/40" />
            <button
              type="button"
              onClick={() => void send('tapped')}
              data-testid="voice-stop"
              className="relative grid size-32 place-items-center rounded-full bg-rani text-white shadow-card transition-transform active:scale-[.97] motion-reduce:transform-none"
            >
              <span className="grid justify-items-center gap-1 text-[15px] font-bold">
                <span aria-hidden="true" className="size-8 rounded-[8px] bg-white" />
                {t('stop')}
              </span>
            </button>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full bg-peacock transition-[width] duration-75" style={{ width: `${Math.min(100, Math.round(level * 160))}%` }} />
          </div>
          <p className="text-[13.5px] text-muted">{t('stopsItself', { seconds: maxSeconds })}</p>
        </Card>
      )}

      {phase === 'sending' && (
        <Card className="text-center">
          <p role="status" className="text-[15px]">
            {t('working')}
          </p>
        </Card>
      )}

      {error && (
        <p role="alert" className="rounded-chip bg-rani/10 px-3 py-2 text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
    </div>
  );
}
