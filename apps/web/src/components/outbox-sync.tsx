'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { API_OK } from '@/client/api-client';
import { OUTBOX_CHANGED, outbox } from '@/client/outbox';

/** The signed-in person's outbox counts, kept current. */
export function useOutboxCounts(userId: string) {
  const [counts, setCounts] = useState({ waiting: 0, failed: 0 });
  useEffect(() => {
    const read = () => void outbox(userId).counts().then(setCounts);
    read();
    window.addEventListener(OUTBOX_CHANGED, read);
    return () => window.removeEventListener(OUTBOX_CHANGED, read);
  }, [userId]);
  return counts;
}

/**
 * Sends the phone's outbox whenever there may be signal (TRD §8.2): on opening, when the signal returns, when the app
 * comes back to the screen, and after any successful request. iPhone has no background sync, so these are the moments.
 * Shows a quiet "2 waiting to send" note, "1 couldn't send" with a link to fix it, or, when the sign-in has ended,
 * a link to sign in again (the entries keep waiting and send once the person is back).
 */
export function OutboxSync({ userId }: { userId: string }) {
  const t = useTranslations('outbox');
  const router = useRouter();
  const { waiting, failed } = useOutboxCounts(userId);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    const flush = () =>
      void outbox(userId)
        .flush()
        .then((result) => {
          setSignedOut(result.signedOut);
          if (result.sent > 0) router.refresh();
        });
    const visible = () => {
      if (document.visibilityState === 'visible') flush();
    };
    flush();
    window.addEventListener('online', flush);
    window.addEventListener(API_OK, flush);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', flush);
      window.removeEventListener(API_OK, flush);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [router, userId]);

  if (waiting === 0 && failed === 0) return null;
  return (
    <p className="mx-auto my-2 w-fit rounded-full bg-white px-3 py-1 text-center text-[13.5px] font-semibold text-ink shadow-card" data-testid="outbox-status">
      {waiting > 0 &&
        (signedOut ? (
          <Link href="/sign-in" className="underline">
            {t('signInToSend', { count: waiting })}
          </Link>
        ) : (
          t('waiting', { count: waiting })
        ))}
      {waiting > 0 && failed > 0 && ' '}
      {failed > 0 && (
        <Link href="/add#outbox" className="text-rani underline">
          {t('failed', { count: failed })}
        </Link>
      )}
    </p>
  );
}
