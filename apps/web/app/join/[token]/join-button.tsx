'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { NavLink } from '@/components/nav-link';
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
        <NavLink href="/home" direction="tab" className="flex min-h-11 items-center justify-center rounded-action bg-peacock px-4 font-semibold text-white">
          {t('goHome')}
        </NavLink>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold">{t('title')}</h1>
      <Button
        size="lg"
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
        <p role="alert" className="text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
    </div>
  );
}
