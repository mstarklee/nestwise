'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

/** Our own email + password (no email codes, no Google for now). New people create an account here too. */
export function SignInForm() {
  const t = useTranslations('signIn');
  const errorText = useErrorText();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/v1/auth/${mode}`, { email: String(form.get('email')), password: String(form.get('password')) });
      router.replace(next?.startsWith('/') ? next : '/home');
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-semibold">{t(mode === 'signin' ? 'titleSignIn' : 'titleSignUp')}</h1>
      <div>
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">{t('password')}</Label>
        <Input id="password" name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required />
        {mode === 'signup' && <p className="mt-1 text-sm text-zinc-500">{t('passwordHint')}</p>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {t(mode === 'signin' ? 'submitSignIn' : 'submitSignUp')}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {t(mode === 'signin' ? 'switchToSignUp' : 'switchToSignIn')}
      </Button>
    </form>
  );
}
