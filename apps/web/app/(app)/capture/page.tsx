import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { readProvider, maxClipSeconds } from '@/capture/clip-limits';
import { DetailHeader } from '@/components/screen-header';
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
  if (actor.role === 'viewer')
    return (
      <>
        <DetailHeader title={t('title')} />
        <p className="rounded-card bg-white p-4 shadow-card">{t('viewerCannot')}</p>
      </>
    );
  const seconds = maxClipSeconds(readProvider(process.env.STT_PROVIDER));

  return (
    <>
      <DetailHeader title={t('title')} />
      <div className="mx-auto max-w-xl">
        <VoiceCapture maxSeconds={seconds} />
      </div>
    </>
  );
}
