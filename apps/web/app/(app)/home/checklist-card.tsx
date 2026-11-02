'use client';

import type { Checklist } from '@nestwise/domain/pot';
import { parseMinor } from '@nestwise/domain/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { formatMoney, formatMoneyRounded, toYm } from '@/client/format';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

type Money = { currency: string; minorUnit: number; locale: string };

/** The 1st-of-month checklist (PRD §5.2): each line is Done, Done — different amount, or Not this month. */
export function ChecklistCard({ checklist, money, canAnswer }: { checklist: Checklist; money: Money; canAnswer: boolean }) {
  const t = useTranslations('checklist');
  const period = toYm(checklist.period);
  const pot = checklist.pot;
  return (
    <Card>
      <CardTitle>{t('title')}</CardTitle>
      <ul className="space-y-4">
        {pot.status === 'pending' && (
          <ChecklistLine
            label={t('potDeposit')}
            suggestedMinor={pot.suggestedMinor}
            hint={pot.estimate ? t('estimate') : null}
            money={money}
            canAnswer={canAnswer}
            confirm={(amountMinor) => api('POST', '/api/v1/pot/deposits', { period, amountMinor })}
            skip={() => api('POST', '/api/v1/pot/skips', { period, itemId: null })}
          />
        )}
        {checklist.savings
          .filter((s) => s.status === 'pending')
          .map((s) => (
            <ChecklistLine
              key={s.itemId}
              label={s.name}
              suggestedMinor={s.plannedMinor}
              hint={
                s.hint
                  ? t('range', {
                      min: formatMoneyRounded(s.hint.minMinor ?? 0, money.currency, money.minorUnit, money.locale),
                      max: formatMoneyRounded(s.hint.maxMinor ?? 0, money.currency, money.minorUnit, money.locale),
                    })
                  : null
              }
              money={money}
              canAnswer={canAnswer}
              confirm={(amountMinor) => api('POST', '/api/v1/pot/savings', { period, itemId: s.itemId, amountMinor })}
              skip={() => api('POST', '/api/v1/pot/skips', { period, itemId: s.itemId })}
            />
          ))}
      </ul>
    </Card>
  );
}

function ChecklistLine(props: {
  label: string;
  suggestedMinor: number;
  hint: string | null;
  money: Money;
  canAnswer: boolean;
  confirm: (amountMinor: number) => Promise<unknown>;
  skip: () => Promise<unknown>;
}) {
  const t = useTranslations('checklist');
  const errorText = useErrorText();
  const router = useRouter();
  const [other, setOther] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { money } = props;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  function confirmOther() {
    let amount: number;
    try {
      amount = parseMinor(other ?? '', money.minorUnit as 0 | 1 | 2 | 3);
    } catch {
      setError(t('badAmount'));
      return;
    }
    void run(() => props.confirm(amount));
  }

  return (
    <li>
      <div className="flex justify-between">
        <span className="font-medium">{props.label}</span>
        <span className="tabular-nums">{formatMoneyRounded(props.suggestedMinor, money.currency, money.minorUnit, money.locale)}</span>
      </div>
      {props.hint && <p className="text-sm text-zinc-500">{props.hint}</p>}
      {props.canAnswer && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => run(() => props.confirm(props.suggestedMinor))} aria-label={t('doneFor', { item: props.label })}>
            {t('done')}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setOther(other === null ? '' : null)}>
            {t('different')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(props.skip)}>
            {t('notThisMonth')}
          </Button>
        </div>
      )}
      {other !== null && (
        <div className="mt-2 flex gap-2">
          <Input
            inputMode="decimal"
            aria-label={t('amountFor', { item: props.label })}
            placeholder={formatMoney(props.suggestedMinor, money.currency, money.minorUnit, money.locale)}
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
          <Button size="sm" disabled={busy} onClick={confirmOther}>
            {t('save')}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}
