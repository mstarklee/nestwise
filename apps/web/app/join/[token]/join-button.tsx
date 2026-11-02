'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { useErrorText } from '@/components/use-error-text';

export function JoinButton({ token, alreadyInFamily }: { token: string; alreadyInFamily: boolean }) {
  const t = useTranslations('join');
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  if (alreadyInFamily) {
    return (
      <div className="space-y-4">
        <p>{t('already')}</p>
        <Link href="/home" className="text-green-900 underline">
          {t('goHome')}
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <Button
        className="w-full"
        onClick={async () => {
          setError(null);
          try {
            await api('POST', `/api/v1/invites/${encodeURIComponent(token)}/accept`, {});
            router.replace('/home');
            router.refresh();
          } catch (e) {
            setError(errorText(e));
          }
        }}
      >
        {t('join')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
