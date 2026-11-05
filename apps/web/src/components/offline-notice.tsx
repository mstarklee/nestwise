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
    <p role="status" className="pt-safe sticky top-0 z-30 bg-gold px-4 py-1 text-center text-[13.5px] font-semibold text-ink">
      {t('offline', { time })}
    </p>
  );
}
