import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { PageLoading } from '@/components/page-loading';
import { ResetPasswordForm } from './reset-password-form';

/** Where the reset link lands. Nothing happens until the new password is saved, so a scanned link stays usable. */
export default function ResetPasswordPage() {
  return (
    <AuthFrame>
      <div className="rounded-card bg-white p-5 shadow-card">
        {/* The form reads ?token= from the address, which is only known in the browser. */}
        <Suspense fallback={<PageLoading />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </AuthFrame>
  );
}
