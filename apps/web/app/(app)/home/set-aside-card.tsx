'use client';

import type { Checklist } from '@nestwise/domain/pot';
import { parseMinor } from '@nestwise/domain/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { formatMoney, formatMoneyRounded, toYm } from '@/client/format';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Input } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';
import type { Money } from '@/http/page-session';

type Line = {
  key: string;
  label: string;
  note: string;
  icon: 'pot' | 'savings';
  suggestedMinor: number;
  hint: string | null;
  status: 'pending' | 'done' | 'skipped';
  confirmedMinor: number | null;
  confirm: (amountMinor: number) => Promise<unknown>;
  skip: () => Promise<unknown>;
};

/**
 * What goes aside this month (PRD §5.2): the pot deposit and each savings item. It stays on Home all month: a line
 * still waiting is Done, Different amount or Not this month; an answered one shows its tick.
 */
export function SetAsideCard({ checklist, money, canAnswer }: { checklist: Checklist; money: Money; canAnswer: boolean }) {
  const t = useTranslations('checklist');
  const tHome = useTranslations('home.setAsideList');
  const period = toYm(checklist.period);
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const lines: Line[] = [
    {
      key: 'pot',
      label: t('potDeposit'),
      note: tHome('potNote'),
      icon: 'pot',
      suggestedMinor: checklist.pot.suggestedMinor,
      hint: checklist.pot.estimate ? t('estimate') : null,
      status: checklist.pot.status,
      confirmedMinor: checklist.pot.confirmedMinor,
      confirm: (amountMinor) => api('POST', '/api/v1/pot/deposits', { period, amountMinor }),
      skip: () => api('POST', '/api/v1/pot/skips', { period, itemId: null }),
    },
    ...checklist.savings.map(
      (s): Line => ({
        key: s.itemId,
        label: s.name,
        note: tHome('savingsNote'),
        icon: 'savings',
        suggestedMinor: s.plannedMinor,
        hint: s.hint ? t('range', { min: rounded(s.hint.minMinor ?? 0), max: rounded(s.hint.maxMinor ?? 0) }) : null,
        status: s.status,
        confirmedMinor: s.confirmedMinor,
        confirm: (amountMinor) => api('POST', '/api/v1/pot/savings', { period, itemId: s.itemId, amountMinor }),
        skip: () => api('POST', '/api/v1/pot/skips', { period, itemId: s.itemId }),
      }),
    ),
  ];
  const waiting = lines.filter((l) => l.status === 'pending');
  const answered = lines.filter((l) => l.status !== 'pending');

  return (
    <Card aria-labelledby="set-aside-title" data-testid="set-aside-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="set-aside-title" className="font-display text-[19px] font-bold leading-tight">
          {tHome('title')}
        </h2>
        <span className="whitespace-nowrap text-[13.5px] font-bold text-peacock">{tHome('count', { done: answered.length, count: lines.length })}</span>
      </div>
      <ul className="mt-1 divide-y divide-line">
        {[...waiting, ...answered].map((line) =>
          line.status === 'pending' ? (
            <WaitingLine key={line.key} line={line} money={money} canAnswer={canAnswer} />
          ) : (
            <li key={line.key} className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5 py-2.5" data-testid="set-aside-row" data-state={line.status}>
              <span aria-hidden="true" className={cn('grid size-10 place-items-center rounded-[13px]', line.status === 'done' ? 'bg-leaf/10 text-leaf' : 'bg-mist text-muted')}>
                <Icon name={line.status === 'done' ? 'check' : line.icon} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-tight text-muted">{line.label}</p>
                <p className={cn('text-[12.5px]', line.status === 'done' ? 'font-semibold text-leaf' : 'text-muted')}>
                  {line.status === 'done' ? tHome('done') : t('notThisMonth')}
                </p>
              </div>
              {line.status === 'done' && line.confirmedMinor !== null && <span className="money text-[15.5px] font-bold text-muted">{rounded(line.confirmedMinor)}</span>}
            </li>
          ),
        )}
      </ul>
      {waiting.length === 0 && <p className="mt-1 text-[13.5px] text-muted">{tHome('allDone')}</p>}
    </Card>
  );
}

function WaitingLine({ line, money, canAnswer }: { line: Line; money: Money; canAnswer: boolean }) {
  const t = useTranslations('checklist');
  const errorText = useErrorText();
  const router = useRouter();
  const [other, setOther] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    void run(() => line.confirm(amount));
  }

  return (
    <li className="py-2.5" data-testid="set-aside-row" data-state="pending">
      <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-[13px] bg-peacock/10 text-peacock">
          <Icon name={line.icon} className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight">{line.label}</p>
          <p className="text-[12.5px] text-muted">{line.hint ?? line.note}</p>
        </div>
        <span className="money text-[15.5px] font-bold">{formatMoneyRounded(line.suggestedMinor, money.currency, money.minorUnit, money.locale)}</span>
      </div>
      {canAnswer && (
        <div className="mt-2 flex flex-wrap gap-2 pl-[50px]">
          <Button size="sm" disabled={busy} onClick={() => run(() => line.confirm(line.suggestedMinor))} aria-label={t('doneFor', { item: line.label })}>
            {t('done')}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setOther(other === null ? '' : null)}>
            {t('different')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(line.skip)}>
            {t('notThisMonth')}
          </Button>
        </div>
      )}
      {other !== null && (
        <div className="mt-2 flex gap-2 pl-[50px]">
          <Input
            inputMode="decimal"
            aria-label={t('amountFor', { item: line.label })}
            placeholder={formatMoney(line.suggestedMinor, money.currency, money.minorUnit, money.locale)}
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
          <Button size="sm" disabled={busy} onClick={confirmOther}>
            {t('save')}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 pl-[50px] text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
    </li>
  );
}
