import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PageLoading } from '@/components/page-loading';
import { Card } from '@/components/ui/card';
import { pageUser } from '@/http/page-session';
import { SignOutButton } from './sign-out-button';

export default function AccountPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await pageUser();
  const t = await getTranslations('settings');
  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('accountTitle')}</h1>
      <Card>
        <p className="text-sm text-zinc-500">{t('signedInAs')}</p>
        <p>{user.email}</p>
      </Card>
      <Card className="space-y-2">
        <Link href="/settings/family" className="block text-green-900 underline">
          {t('familyTitle')}
        </Link>
        <Link href="/install" className="block text-green-900 underline">
          {t('install')}
        </Link>
      </Card>
      <SignOutButton />
    </div>
  );
}
