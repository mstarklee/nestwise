'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Admin actions on an open yearly line: give it a month (or none), mark it done, or drop it this year. */
export function YearLineActions({
  year,
  line,
  locale,
}: {
  year: number;
  line: { id: string; dueMonth: number | null; dueDay: number | null; paid: boolean };
  locale: string;
}) {
  const t = useTranslations('year');
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/v1/years/${year}/lines/${line.id}`;
  const monthName = (month: number) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, 1));

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Select
        className="h-8 w-36 text-sm"
        aria-label={t('setMonth')}
        value={line.dueMonth ?? ''}
        disabled={busy}
        onChange={(e) => {
          const dueMonth = e.target.value === '' ? null : Number(e.target.value);
          // Keep the line's day when only the month changes; no month means no day.
          void run(() => api('PUT', `${base}/schedule`, { dueMonth, dueDay: dueMonth === null ? null : line.dueDay }));
        }}
      >
        <option value="">{t('noMonth')}</option>
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {monthName(m)}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api('POST', `${base}/done`))}>
        {t('markDone')}
      </Button>
      {!line.paid && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api('POST', `${base}/cancel`))}>
          {t('drop')}
        </Button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
