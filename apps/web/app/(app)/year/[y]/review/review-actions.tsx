'use client';

import { parseMinor } from '@nestwise/domain/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

/** One line's amount for that year only (the template stays as it is). */
export function AmountEditor({ year, lineId, initial, minorUnit }: { year: number; lineId: string; initial: string; minorUnit: number }) {
  const t = useTranslations('nextYear');
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let plannedMinor: number;
    try {
      plannedMinor = parseMinor(String(new FormData(event.currentTarget).get('amount')), minorUnit as 0 | 1 | 2 | 3);
    } catch {
      setError(t('badAmount'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('PUT', `/api/v1/years/${year}/lines/${lineId}/amount`, { plannedMinor });
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex items-center gap-2">
      <Input name="amount" inputMode="decimal" defaultValue={initial} aria-label={t('amount')} className="h-8 w-32 text-sm" />
      <Button size="sm" variant="outline" type="submit" disabled={busy}>
        {t('save')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

/** "Looks right": the next-year card goes away for the whole family. */
export function LooksRight({ year }: { year: number }) {
  const t = useTranslations('nextYear');
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api('POST', `/api/v1/years/${year}/next-year-review`);
            router.refresh();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('looksRight')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
