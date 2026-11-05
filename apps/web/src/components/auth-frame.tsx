import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { TempleBorder } from './temple-border';

/**
 * The frame for the screens before the app proper (sign-in, join, setup): a peacock header with the temple border and
 * the app name in Baloo (and "Step 1 of 3" while setting up), then the content, usually a white card.
 */
export function AuthFrame({ step, children }: { step?: { n: number; of: number }; children: ReactNode }) {
  const app = useTranslations('app');
  const setup = useTranslations('setup');
  return (
    <div className="min-h-dvh">
      <header className="on-peacock pt-safe bg-peacock text-white">
        <div className="mx-auto flex max-w-xl items-end justify-between gap-3 px-5 pb-4 pt-4">
          <p className="font-display text-[30px] font-extrabold leading-none">{app('name')}</p>
          {step ? <p className="rounded-full bg-white/15 px-3 py-1 text-[13.5px] font-semibold">{setup('step', { step: step.n, total: step.of })}</p> : null}
        </div>
        <TempleBorder />
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-6 md:max-w-md">{children}</main>
    </div>
  );
}
