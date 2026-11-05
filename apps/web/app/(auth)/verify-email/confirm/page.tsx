import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { PageLoading } from '@/components/page-loading';
import { ConfirmEmail } from './confirm-email';

/** Where the "Verify my email" link lands. The token is confirmed by the page's script, not by simply loading the link. */
export default function ConfirmEmailPage() {
  return (
    <AuthFrame>
      <div className="rounded-card bg-white p-5 shadow-card">
        <Suspense fallback={<PageLoading />}>
          <ConfirmEmail />
        </Suspense>
      </div>
    </AuthFrame>
  );
}
