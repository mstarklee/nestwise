'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

const GOOGLE_ERRORS = ['google', 'google_cancelled', 'google_unavailable', 'google_conflict'] as const;
type GoogleError = (typeof GOOGLE_ERRORS)[number];
const isGoogleError = (value: string | null): value is GoogleError => GOOGLE_ERRORS.includes(value as GoogleError);

/** An in-app path from ?next=, never another site. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null);

/** Google's "G", in its own colours (Google's sign-in button guidelines). */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Email + password, or Google. New people create an account here too; a new email account then verifies its email. */
export function SignInForm() {
  const t = useTranslations('signIn');
  const errorText = useErrorText();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const googleError = params.get('error');
  const [mode, setMode] = useState<'signin' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [error, setError] = useState<string | null>(isGoogleError(googleError) ? t(`errors.${googleError}`) : null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get('email')), password: String(form.get('password')) };
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await api('POST', '/api/v1/auth/signup', { ...credentials, ...(next ? { returnTo: next } : {}) });
        router.replace(next ? `/verify-email?next=${encodeURIComponent(next)}` : '/verify-email');
      } else {
        await api('POST', '/api/v1/auth/signin', credentials);
        router.replace(next ?? '/home');
      }
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const googleHref = `/api/v1/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`;

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-[24px] font-bold">{t(mode === 'signin' ? 'titleSignIn' : 'titleSignUp')}</h1>
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" name="password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required />
          {mode === 'signup' ? (
            <p className="mt-1 text-[13.5px] text-muted">{t('passwordHint')}</p>
          ) : (
            <p className="mt-2 text-right">
              <Link href="/forgot-password" className="text-[13.5px] font-semibold text-peacock underline-offset-2 hover:underline">
                {t('forgotPassword')}
              </Link>
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-[13.5px] font-semibold text-rani">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {t(mode === 'signin' ? 'submitSignIn' : 'submitSignUp')}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-[13.5px] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t('or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      {/* A plain link: the whole page goes to Google and comes back, so no script is needed. */}
      <a
        href={googleHref}
        className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-action bg-white px-6 text-base font-semibold text-ink ring-1 ring-line transition-transform hover:bg-mist active:scale-[.97] motion-reduce:transform-none"
      >
        <GoogleMark />
        {t('continueWithGoogle')}
      </a>

      <Button type="button" variant="ghost" className="w-full" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}>
        {t(mode === 'signin' ? 'switchToSignUp' : 'switchToSignIn')}
      </Button>
    </div>
  );
}
