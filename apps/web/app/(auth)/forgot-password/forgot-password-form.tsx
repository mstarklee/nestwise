'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

/** Asks for a reset link. The answer is the same whether or not the email has an account. */
export function ForgotPasswordForm() {
  const t = useTranslations('forgotPassword');
  const signIn = useTranslations('signIn');
  const errorText = useErrorText();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/v1/auth/password/forgot', { email });
      setSentTo(email);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href="/sign-in" className="block text-center text-[13.5px] font-semibold text-peacock underline-offset-2 hover:underline">
      {t('backToSignIn')}
    </Link>
  );

  if (sentTo) {
    return (
      <div className="space-y-4">
        <h1 className="text-[24px] font-bold">{t('sentTitle')}</h1>
        <p role="status">{t('sentBody', { email: sentTo })}</p>
        {back}
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-[24px] font-bold">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <div>
        <Label htmlFor="email">{signIn('email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {t('submit')}
      </Button>
      {back}
    </form>
  );
}
