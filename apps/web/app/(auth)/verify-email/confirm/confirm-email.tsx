'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/client/api-client';
import { buttonClass } from '@/components/ui/button';

const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null);

/**
 * Confirms the token once, when the page opens (a POST, so an email scanner that only fetches the link changes
 * nothing). Then: continue into the app, which goes to sign-in if this device has no session.
 */
export function ConfirmEmail() {
  const t = useTranslations('verifyEmail');
  const params = useSearchParams();
  const token = params.get('token');
  const next = safeNext(params.get('next')) ?? '/home';
  const [state, setState] = useState<'confirming' | 'confirmed' | 'failed'>(token ? 'confirming' : 'failed');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // React's development double-run would otherwise use the link twice
    api('POST', '/api/v1/auth/verification/confirm', { token })
      .then(() => setState('confirmed'))
      .catch(() => setState('failed'));
  }, [token]);

  if (state === 'confirming') {
    return (
      <p role="status" className="text-[20px] font-bold">
        {t('confirmingTitle')}
      </p>
    );
  }
  if (state === 'failed') {
    return (
      <div className="space-y-4">
        <h1 className="text-[24px] font-bold">{t('failedTitle')}</h1>
        <p>{t('failedBody')}</p>
        <Link href="/sign-in" className={buttonClass({ size: 'lg', className: 'w-full' })}>
          {t('goToSignIn')}
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold">{t('confirmedTitle')}</h1>
      <p>{t('confirmedBody')}</p>
      <Link href={next} className={buttonClass({ size: 'lg', className: 'w-full' })}>
        {t('continue')}
      </Link>
    </div>
  );
}
