'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const t = useTranslations('settings');
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="lg" className="w-full"
      onClick={async () => {
        await api('POST', '/api/v1/auth/signout').catch(() => undefined);
        router.replace('/sign-in');
        router.refresh();
      }}
    >
      {t('signOut')}
    </Button>
  );
}
