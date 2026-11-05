'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { formatMoney, formatMonthShort } from '@/client/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useErrorText } from '@/components/use-error-text';

interface Line {
  readonly id: string;
  readonly name: string;
  readonly plannedMinor: number;
  readonly dueMonth: number | null;
}

/**
 * Step 3, the first-year check: which of this year's items are still to come? Dated items due from this month on
 * start ticked; unticked items become "Before NestWise" and stay out of the pot and the forecast.
 */
export function FirstYearCheckForm({
  year,
  setupMonth,
  lines,
  money,
}: {
  year: number;
  setupMonth: string;
  lines: readonly Line[];
  money: { currency: string; minorUnit: number; locale: string };
}) {
  const t = useTranslations('setup');
  const errorText = useErrorText();
  const router = useRouter();
  const [ticked, setTicked] = useState(() => new Set(lines.filter((l) => l.dueMonth !== null).map((l) => l.id)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setTicked((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/v1/years/${year}/first-year-check`, { stillToComeLineIds: [...ticked], setupMonth });
      router.push('/home');
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold">{t('checkTitle', { year })}</h1>
      <p className="text-muted">{t('checkIntro')}</p>
      <Card>
        {lines.length === 0 && <p className="text-muted">{t('checkNothing')}</p>}
        <ul className="divide-y divide-line">
          {lines.map((line) => (
            <li key={line.id}>
              <label className="flex min-h-12 items-center gap-3 py-2">
                <input type="checkbox" className="size-6 accent-peacock" checked={ticked.has(line.id)} onChange={() => toggle(line.id)} />
                <span className="flex-1">{line.name}</span>
                <span className="text-[13.5px] text-muted">
                  {line.dueMonth === null ? t('noMonth') : formatMonthShort({ year, month: line.dueMonth }, money.locale)}
                </span>
                <span className="w-28 text-right money">{formatMoney(line.plannedMinor, money.currency, money.minorUnit, money.locale)}</span>
              </label>
            </li>
          ))}
        </ul>
        {lines.length > 0 && (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setTicked(new Set(lines.map((l) => l.id)))}>
            {t('tickAll')}
          </Button>
        )}
      </Card>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={busy} size="lg" className="w-full">
        {t('checkDone')}
      </Button>
    </div>
  );
}
