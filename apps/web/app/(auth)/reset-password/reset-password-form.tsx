'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api, ApiError } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

/** Sets the new password; the browser is then signed in and goes into the app. */
export function ResetPasswordForm() {
  const t = useTranslations('resetPassword');
  const signIn = useTranslations('signIn');
  const errorText = useErrorText();
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string | null>(token ? null : t('missingToken'));
  const [linkDead, setLinkDead] = useState(!token);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/v1/auth/password/reset', { token, password });
      router.replace('/home');
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setLinkDead(e instanceof ApiError && e.code === 'InvalidAuthLinkError');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-[24px] font-bold">{t('title')}</h1>
      {!linkDead && (
        <div>
          <Label htmlFor="password">{t('newPassword')}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <p className="mt-1 text-[13.5px] text-muted">{signIn('passwordHint')}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
      {linkDead ? (
        <Link href="/forgot-password" className="block text-center font-semibold text-peacock underline-offset-2 hover:underline">
          {t('askAgain')}
        </Link>
      ) : (
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {t('submit')}
        </Button>
      )}
    </form>
  );
}
