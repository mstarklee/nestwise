'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/** "Offline — figures as of 08:14" while there is no signal (TRD §8.2); the time is when this page was made. */
export function OfflineNotice({ asOf }: { asOf: string }) {
  const t = useTranslations('outbox');
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  const time = new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <p role="status" className="bg-amber-50 px-4 py-1 text-center text-xs text-amber-900">
      {t('offline', { time })}
    </p>
  );
}
