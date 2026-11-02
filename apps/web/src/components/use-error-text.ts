'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/client/api-client';

/** Turns an API failure into a sentence from en.json: a known error code first, then the HTTP status. */
export function useErrorText() {
  const t = useTranslations('errors');
  return (error: unknown): string => {
    if (!(error instanceof ApiError)) return t('generic');
    if (t.has(`codes.${error.code}`)) return t(`codes.${error.code}`);
    if (error.status === 0) return t('offline');
    if (t.has(`status.${error.status}`)) return t(`status.${error.status}`);
    return t('generic');
  };
}
