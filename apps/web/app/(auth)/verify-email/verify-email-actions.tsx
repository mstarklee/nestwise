'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { useErrorText } from '@/components/use-error-text';

type Result = 'sent' | 'too_soon' | 'already_verified';
const MESSAGE: Record<Result, 'sent' | 'tooSoon' | 'alreadyVerified'> = { sent: 'sent', too_soon: 'tooSoon', already_verified: 'alreadyVerified' };

/** Resend the link, carry on once it is opened (on this or another device), or switch account. */
export function VerifyEmailActions({ next }: { next: string | null }) {
  const t = useTranslations('verifyEmail');
  const errorText = useErrorText();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      const { result } = await api<{ result: Result }>('POST', '/api/v1/auth/verification/resend', next ? { returnTo: next } : {});
      setMessage(t(MESSAGE[result]));
      if (result === 'already_verified') router.refresh();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {message && (
        <p role="status" className="text-[13.5px] font-semibold text-peacock">
          {message}
        </p>
      )}
      {/* After opening the link elsewhere, this re-checks: the page moves on once the email is verified. */}
      <Button size="lg" className="w-full" onClick={() => router.refresh()}>
        {t('continue')}
      </Button>
      <Button variant="outline" size="lg" className="w-full" disabled={busy} onClick={resend}>
        {t('resend')}
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        onClick={async () => {
          await api('POST', '/api/v1/auth/signout').catch(() => undefined);
          router.replace('/sign-in');
          router.refresh();
        }}
      >
        {t('signOut')}
      </Button>
    </div>
  );
}
