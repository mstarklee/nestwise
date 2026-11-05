'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Icon } from './icon';
import { Sheet } from './sheet';

/** The Scan button before Photo receipts exists: it looks live, has a "Soon" tag, and says it is coming (design spec §6.2). */
export function ScanSoon({ className }: { className?: string }) {
  const t = useTranslations('home');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} data-testid="home-scan">
        <span className="relative grid size-11 place-items-center rounded-full bg-white/40">
          <Icon name="scan" className="size-6" />
        </span>
        <span className="flex items-center gap-1.5">
          {t('scan')}
          <span className="rounded-full bg-ink px-1.5 py-px text-[11.5px] font-semibold leading-tight text-white">{t('soon')}</span>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('scanTitle')}>
        <p className="mb-4 text-[15px]">
          {t('scanSoon')}
        </p>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-full rounded-action bg-peacock font-semibold text-white active:scale-[.97]">
          {t('scanOk')}
        </button>
      </Sheet>
    </>
  );
}
