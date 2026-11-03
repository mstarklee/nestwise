'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { API_OK } from '@/client/api-client';
import { OUTBOX_CHANGED, outbox } from '@/client/outbox';

/** The outbox's waiting and failed counts, kept current. */
export function useOutboxCounts() {
  const [counts, setCounts] = useState({ waiting: 0, failed: 0 });
  useEffect(() => {
    const read = () => void outbox().counts().then(setCounts);
    read();
    window.addEventListener(OUTBOX_CHANGED, read);
    return () => window.removeEventListener(OUTBOX_CHANGED, read);
  }, []);
  return counts;
}

/**
 * Sends the phone's outbox whenever there may be signal (TRD §8.2): on opening, when the signal returns, when the app
 * comes back to the screen, and after any successful request. iPhone has no background sync, so these are the moments.
 * Shows a quiet "2 waiting to send" note, or "1 couldn't send" with a link to fix it.
 */
export function OutboxSync() {
  const t = useTranslations('outbox');
  const router = useRouter();
  const { waiting, failed } = useOutboxCounts();

  useEffect(() => {
    const flush = () =>
      void outbox()
        .flush()
        .then((result) => {
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
  }, [router]);

  if (waiting === 0 && failed === 0) return null;
  return (
    <p className="text-center text-xs text-zinc-600" data-testid="outbox-status">
      {waiting > 0 && t('waiting', { count: waiting })}
      {waiting > 0 && failed > 0 && ' · '}
      {failed > 0 && (
        <Link href="/add#outbox" className="text-red-700 underline">
          {t('failed', { count: failed })}
        </Link>
      )}
    </p>
  );
}
