'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOnline, useVoiceRecorder } from '@/components/use-voice-recorder';

/**
 * The listening state, shared by the Speak pop-up and the /capture page: "Listening…", the timer, the big
 * "I'm done" button with its pulse, the input level, and when it stops by itself.
 */
export function ListeningPanel({ seconds, level, maxSeconds, onDone }: { seconds: number; level: number; maxSeconds: number; onDone: () => void }) {
  const t = useTranslations('voice');
  return (
    <div className="flex flex-col items-center space-y-4 text-center">
      <p role="status" className="inline-flex items-center gap-1.5 text-[15px] font-bold text-rani">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-rani" />
        {t('listening')}
      </p>
      <p className="money text-[40px] font-extrabold leading-none" data-testid="voice-timer">
        0:{String(Math.min(seconds, maxSeconds)).padStart(2, '0')}
      </p>
      <div className="relative grid size-32 place-items-center">
        <span aria-hidden="true" className="animate-pulse-ring absolute inset-0 rounded-full bg-rani/40" />
        <button
          type="button"
          onClick={onDone}
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
    </div>
  );
}

/**
 * The /capture page: tap to start, tap to stop (PRD §6.11). Speak on Home and Add opens the same recorder in a
 * pop-up that starts at once; this page stays for direct links.
 *
 * Voice needs a signal: with none, this offers typing instead rather than storing recordings for later (design §2).
 */
export function VoiceCapture({ maxSeconds }: { maxSeconds: number }) {
  const t = useTranslations('voice');
  const router = useRouter();
  const online = useOnline();
  const voice = useVoiceRecorder(maxSeconds);

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
      {(voice.phase === 'ready' || voice.phase === 'starting') && (
        <Card className="flex flex-col items-center space-y-4 py-6 text-center">
          <p className="text-[15px]">{t('explain', { seconds: maxSeconds })}</p>
          <button
            type="button"
            onClick={() => void voice.begin()}
            disabled={voice.phase === 'starting'}
            data-testid="voice-start"
            className="grid size-32 place-items-center rounded-full bg-rani text-white shadow-card transition-transform active:scale-[.97] disabled:opacity-70 motion-reduce:transform-none"
          >
            <span className="grid justify-items-center gap-1 text-[15px] font-bold">
              <Icon name="mic" className="size-10" />
              {t('start')}
            </span>
          </button>
          <p className="max-w-xs text-[13.5px] text-muted">{t('example')}</p>
        </Card>
      )}

      {voice.phase === 'recording' && (
        <Card className="py-6">
          <ListeningPanel seconds={voice.seconds} level={voice.level} maxSeconds={maxSeconds} onDone={voice.finish} />
        </Card>
      )}

      {voice.phase === 'sending' && (
        <Card className="text-center">
          <p role="status" className="text-[15px]">
            {t('working')}
          </p>
        </Card>
      )}

      {voice.error && (
        <p role="alert" className="rounded-chip bg-rani/10 px-3 py-2 text-[13.5px] font-semibold text-rani">
          {voice.error}
        </p>
      )}
    </div>
  );
}
