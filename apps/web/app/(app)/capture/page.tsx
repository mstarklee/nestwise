import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { readProvider, maxClipSeconds } from '@/capture/clip-limits';
import { PageLoading } from '@/components/page-loading';
import { VoiceCapture } from '@/components/voice-capture';
import { pageContext } from '@/http/page-session';

export default function CapturePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Capture />
    </Suspense>
  );
}

/** Speak a batch of expenses (PRD §6.11). The clip limit comes from whichever speech service is configured. */
async function Capture() {
  await pageContext();
  const t = await getTranslations('voice');
  const seconds = maxClipSeconds(readProvider(process.env.STT_PROVIDER));

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <VoiceCapture maxSeconds={seconds} />
    </div>
  );
}
