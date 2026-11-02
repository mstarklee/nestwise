import { Suspense } from 'react';
import { PageLoading } from '@/components/page-loading';
import { SignInForm } from './sign-in-form';

export default function SignInPage() {
  return (
    <main className="pt-safe mx-auto w-full max-w-sm px-4 py-10">
      {/* The form reads ?next= from the address, which is only known in the browser. */}
      <Suspense fallback={<PageLoading />}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
