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
  const { actor } = await pageContext();
  const t = await getTranslations('voice');
  // A Viewer may not record an expense, so their microphone is never opened — the use case would refuse the upload
  // anyway, but asking for the microphone first and failing after is no way to tell someone they cannot do this.
  if (actor.role === 'viewer') return <p className="py-4 text-sm">{t('viewerCannot')}</p>;
  const seconds = maxClipSeconds(readProvider(process.env.STT_PROVIDER));

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <VoiceCapture maxSeconds={seconds} />
    </div>
  );
}
