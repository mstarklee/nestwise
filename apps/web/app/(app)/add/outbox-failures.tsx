'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ApiError } from '@/client/api-client';
import { formatDay, formatMoney } from '@/client/format';
import { OUTBOX_CHANGED, type OutboxEntry, outbox } from '@/client/outbox';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { useErrorText } from '@/components/use-error-text';

type Money = { currency: string; minorUnit: number; locale: string };

/** Expenses saved on the phone that the server refused: shown until the person discards them (never dropped silently). */
export function OutboxFailures({ money, userId }: { money: Money; userId: string }) {
  const t = useTranslations('outbox');
  const errorText = useErrorText();
  const [failed, setFailed] = useState<OutboxEntry[]>([]);

  useEffect(() => {
    const read = () => void outbox(userId).list().then((all) => setFailed(all.filter((e) => e.state === 'failed')));
    read();
    window.addEventListener(OUTBOX_CHANGED, read);
    return () => window.removeEventListener(OUTBOX_CHANGED, read);
  }, [userId]);

  if (failed.length === 0) return null;
  return (
    <Card id="outbox" className="space-y-2">
      <CardTitle>{t('failedTitle')}</CardTitle>
      <p className="text-sm text-zinc-600">{t('failedExplain')}</p>
      <ul className="divide-y divide-zinc-100">
        {failed.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span>
              {formatMoney(Number(entry.body.amountMinor), money.currency, money.minorUnit, money.locale)}
              {typeof entry.body.txnDate === 'string' && ` · ${formatDay(entry.body.txnDate, money.locale)}`}
              <span className="block text-red-700">{errorText(new ApiError(entry.error?.status ?? 0, entry.error?.code ?? 'ServerError', ''))}</span>
            </span>
            <Button size="sm" variant="outline" onClick={() => void outbox(userId).discard(entry.id)}>
              {t('discard')}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
