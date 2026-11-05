import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { PageLoading } from '@/components/page-loading';
import { SignInForm } from './sign-in-form';

export default function SignInPage() {
  return (
    <AuthFrame>
      <div className="rounded-card bg-white p-5 shadow-card">
        {/* The form reads ?next= from the address, which is only known in the browser. */}
        <Suspense fallback={<PageLoading />}>
          <SignInForm />
        </Suspense>
      </div>
    </AuthFrame>
  );
}
