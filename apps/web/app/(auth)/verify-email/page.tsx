import { safeReturnTo } from '@nestwise/domain/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { PageLoading } from '@/components/page-loading';
import { pageSignedIn } from '@/http/page-session';
import { VerifyEmailActions } from './verify-email-actions';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** "Check your email": where a signed-in person waits until they open the verify link. */
export default function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthFrame>
      <div className="rounded-card bg-white p-5 shadow-card">
        <Suspense fallback={<PageLoading />}>
          <VerifyEmail searchParams={searchParams} />
        </Suspense>
      </div>
    </AuthFrame>
  );
}

async function VerifyEmail({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).next;
  const next = safeReturnTo(typeof raw === 'string' ? raw : undefined);
  const user = await pageSignedIn(next);
  if (user.emailVerified) redirect(next ?? '/home');
  const t = await getTranslations('verifyEmail');
  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold">{t('title')}</h1>
      <p>{t.rich('body', { email: user.email, strong: (chunks) => <strong>{chunks}</strong> })}</p>
      <p className="text-[13.5px] text-muted">{t('hint')}</p>
      <VerifyEmailActions next={next ?? null} />
    </div>
  );
}
