'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import { useOnline, useVoiceRecorder } from '@/components/use-voice-recorder';
import { ListeningPanel } from '@/components/voice-capture';

/**
 * Speak: one tap opens the pop-up and starts listening (design 2026-11-08 §6). It stops on "I'm done", after a
 * stretch of quiet, or at the clip limit, then the check page opens. Cancel, the backdrop or Escape throw the
 * recording away.
 */
export function SpeakButton({ className, maxSeconds }: { className: string; maxSeconds: number }) {
  const t = useTranslations('voice');
  const tHome = useTranslations('home');
  const router = useRouter();
  const online = useOnline();
  const voice = useVoiceRecorder(maxSeconds);
  const [open, setOpen] = useState(false);

  function start() {
    setOpen(true);
    // Straight from the tap: iPhone only opens the microphone from a user gesture.
    if (online) void voice.begin();
  }

  function close() {
    if (voice.phase === 'sending') return; // the note is on its way; the check page opens next
    voice.cancel();
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={start} data-testid="home-voice" className={className}>
        <span className="grid size-11 place-items-center rounded-full bg-white/20">
          <Icon name="mic" className="size-6" />
        </span>
        {tHome('speak')}
      </button>

      <Sheet open={open} onClose={close} title={t('title')}>
        {voice.phase !== 'sending' && (
          <button type="button" onClick={close} className="absolute right-3 top-3 min-h-11 px-3 text-[14px] font-semibold text-muted">
            {t('cancel')}
          </button>
        )}
        <div className="pb-2 pt-1" data-testid="voice-sheet">
          {!online ? (
            <div className="space-y-3" data-testid="voice-offline">
              <p className="text-[15px]">{t('needsSignal')}</p>
              <Button className="w-full" onClick={() => router.push('/add')}>
                {t('typeInstead')}
              </Button>
            </div>
          ) : voice.phase === 'recording' ? (
            <div className="space-y-3">
              <ListeningPanel seconds={voice.seconds} level={voice.level} maxSeconds={maxSeconds} onDone={voice.finish} />
              <p className="text-center text-[13px] italic text-muted">{t('example')}</p>
            </div>
          ) : voice.phase === 'sending' ? (
            <p role="status" className="py-8 text-center text-[15px] font-semibold">
              {t('working')}
            </p>
          ) : voice.error ? (
            <div className="space-y-3 py-2 text-center">
              <p role="alert" className="rounded-chip bg-rani/10 px-3 py-2 text-[13.5px] font-semibold text-rani">
                {voice.error}
              </p>
              <Button className="w-full" onClick={() => void voice.begin()}>
                {t('tryAgain')}
              </Button>
            </div>
          ) : (
            <p role="status" className="py-8 text-center text-[15px] text-muted">
              {t('opening')}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
