'use client';

import { parseMinor } from '@nestwise/domain/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { formatMoney, minorToInput } from '@/client/format';
import { Input } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

type Money = { currency: string; minorUnit: number; locale: string };

/** Tap the planned amount to change it for this month only (AC-07). */
export function PlannedEditor({ ym, itemId, plannedMinor, money }: { ym: string; itemId: string; plannedMinor: number; money: Money }) {
  const t = useTranslations('month');
  const errorText = useErrorText();
  const router = useRouter();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value === null) return;
    let minor = 0;
    try {
      if (value.trim() !== '' && value.trim() !== '0') minor = parseMinor(value, money.minorUnit as 0 | 1 | 2 | 3);
    } catch {
      setError(t('badAmount'));
      return;
    }
    try {
      await api('PUT', `/api/v1/months/${ym}/lines/${itemId}`, { plannedMinor: minor });
      setValue(null);
      setError(null);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (value === null) {
    return (
      <button type="button" className="tabular-nums underline decoration-dotted" onClick={() => setValue(minorToInput(plannedMinor, money.minorUnit))}>
        {formatMoney(plannedMinor, money.currency, money.minorUnit, money.locale)}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-col items-end">
      <Input
        autoFocus
        inputMode="decimal"
        className="h-8 w-28 text-right"
        aria-label={t('planned')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') setValue(null);
        }}
      />
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
