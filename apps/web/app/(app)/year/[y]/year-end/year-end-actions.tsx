'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Done / Still to pay (with a month or "No month yet") / Drop, for one of last year's open bills. */
export function YearEndActions({ year, lineId, locale }: { year: number; lineId: string; locale: string }) {
  const t = useTranslations('yearEnd');
  const errorText = useErrorText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState('');
  const monthName = (m: number) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(year + 1, m - 1, 1));

  async function send(answer: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/v1/years/${year}/year-end/lines/${lineId}`, answer);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => send({ kind: 'done' })}>
          {t('done')}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ kind: 'drop' })}>
          {t('drop')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select className="min-h-11 w-40 text-[15px]" aria-label={t('carryMonth', { next: year + 1 })} value={month} onChange={(e) => setMonth(e.target.value)} disabled={busy}>
          <option value="">{t('noMonth')}</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </Select>
        <Button size="sm" disabled={busy} onClick={() => send({ kind: 'carry', dueMonth: month === '' ? null : Number(month) })}>
          {t('carry', { next: year + 1 })}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
    </div>
  );
}
