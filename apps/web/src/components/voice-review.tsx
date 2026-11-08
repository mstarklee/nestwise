'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { api } from '@/client/api-client';
import { formatMoney } from '@/client/format';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

export type ReviewRow = {
  id: string;
  amountMinor: number | null;
  itemId: string | null;
  yearLineId: string | null;
  kind: 'expense' | 'yearly_bill';
  txnDate: string;
  merchant: string | null;
  note: string;
  heard: string;
  needsAttention: boolean;
};

export type ReviewOption = { id: string; name: string; group: string };
export type BillOption = { id: string; name: string; plannedMinor: number; remainingMinor: number };

export type VoiceReviewProps = {
  batchId: string;
  transcript: string;
  rows: ReviewRow[];
  items: ReviewOption[];
  bills: BillOption[];
  /** The pot balance now, and the family's currency, so this component can format amounts itself. */
  potBalanceMinor: number;
  currency: string;
  minorUnit: number;
  locale: string;
  /** Only the speaker may confirm (design §8). */
  mine: boolean;
};

type Draft = ReviewRow & { dropped: boolean };

/**
 * The screen where a spoken note becomes money (design §8): the transcript at the top, then the rows grouped into
 * everyday spending and yearly bills, because only the second kind moves the pot.
 *
 * The amount boxes are **uncontrolled**, matching the Add screen: the form holds the text and it is read back on
 * submit. A row with no amount, or with nothing to put it against, is refused there with a message that says how
 * many rows need attention — rather than by greying the button out, which leaves someone staring at a dead control
 * with no idea why.
 */
export function VoiceReview({ batchId, transcript, rows, items, bills, potBalanceMinor, currency, minorUnit, locale, mine }: VoiceReviewProps) {
  const t = useTranslations('voice');
  const errorText = useErrorText();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);

  const [drafts, setDrafts] = useState<Draft[]>(() => rows.map((row) => ({ ...row, dropped: false })));
  /** A mirror of the amount boxes, for the running totals only. The form is the source of truth at submit. */
  const [shown, setShown] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row.amountMinor === null ? '' : (row.amountMinor / 10 ** minorUnit).toString()])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (minor: number) => formatMoney(minor, currency, minorUnit, locale);
  const update = (id: string, change: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.id === id ? { ...d, ...change } : d)));

  const toMinor = (text: string): number | null => {
    const value = Number(text.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value * 10 ** minorUnit);
  };

  /** What the boxes hold right now; falls back to the mirror before the form has mounted. */
  function typedFields(): Record<string, { amount: string; date: string }> {
    const element = form.current;
    const data = element ? new FormData(element) : null;
    return Object.fromEntries(
      drafts.map((d) => [
        d.id,
        {
          amount: String(data?.get(`amount-${d.id}`) ?? shown[d.id] ?? ''),
          date: String(data?.get(`date-${d.id}`) || d.txnDate),
        },
      ]),
    );
  }

  const keeping = drafts.filter((d) => !d.dropped);
  const expenses = keeping.filter((d) => d.kind === 'expense');
  const billRows = keeping.filter((d) => d.kind === 'yearly_bill');
  const shownMinor = (d: Draft) => toMinor(shown[d.id] ?? '') ?? 0;
  const expenseTotal = expenses.reduce((sum, d) => sum + shownMinor(d), 0);
  const billTotal = billRows.reduce((sum, d) => sum + shownMinor(d), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = typedFields();
    const unready = keeping.filter((d) => toMinor(typed[d.id]?.amount ?? '') === null || (d.kind === 'expense' ? !d.itemId : !d.yearLineId));
    if (unready.length > 0) {
      setError(t('blocked', { count: unready.length }));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/v1/capture/voice/${batchId}/confirm`, {
        entries: drafts.map((d) => ({
          id: d.id,
          amountMinor: toMinor(typed[d.id]?.amount ?? '') ?? 1,
          itemId: d.kind === 'expense' ? d.itemId : null,
          yearLineId: d.kind === 'yearly_bill' ? d.yearLineId : null,
          kind: d.kind,
          txnDate: typed[d.id]?.date ?? d.txnDate,
          merchant: d.merchant,
          note: d.note,
          paidBy: null,
          dropped: d.dropped,
        })),
      });
      router.push('/home');
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  function row(draft: Draft) {
    const bill = draft.kind === 'yearly_bill';
    const chosenBill = bills.find((b) => b.id === draft.yearLineId);
    const minor = shownMinor(draft);
    const short = bill && chosenBill && minor > 0 && minor < chosenBill.remainingMinor;

    return (
      <Card
        key={draft.id}
        data-testid={bill ? 'voice-bill-row' : 'voice-expense-row'}
        className={`space-y-3 ${bill ? 'bg-white ring-2 ring-peacock/30' : draft.needsAttention ? 'bg-white ring-2 ring-gold' : ''}`}
      >
        <p className="text-[13.5px] text-muted">“{draft.heard}”</p>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={t('amount')}
            name={`amount-${draft.id}`}
            inputMode="decimal"
            autoComplete="off"
            className="money w-32 text-[18px] font-bold"
            defaultValue={shown[draft.id] ?? ''}
            placeholder={t('amountMissing')}
            onChange={(e) => setShown((all) => ({ ...all, [draft.id]: e.target.value }))}
          />

          {bill ? (
            <Select
              aria-label={t('bill')}
              className="min-w-40 flex-1"
              value={draft.yearLineId ?? ''}
              onChange={(e) => update(draft.id, { yearLineId: e.target.value || null })}
            >
              <option value="">{t('pickBill')}</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          ) : (
            <Select
              aria-label={t('item')}
              className="min-w-40 flex-1"
              value={draft.itemId ?? ''}
              onChange={(e) => update(draft.id, { itemId: e.target.value || null })}
            >
              <option value="">{t('pickItem')}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          )}

          <Button type="button" size="sm" variant="ghost" className="text-muted" onClick={() => update(draft.id, { dropped: true })}>
            {t('remove')}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label={t('date')} type="date" name={`date-${draft.id}`} className="w-40" defaultValue={draft.txnDate} />
          {draft.merchant && <span className="text-[13.5px] text-muted">{draft.merchant}</span>}
        </div>

        {bill && chosenBill && minor > 0 && (
          <p className="money text-[13.5px] text-peacock" data-testid="voice-bill-effect">
            {t('billEffect', { before: money(potBalanceMinor), after: money(potBalanceMinor - minor) })}
            {short ? ` ${t('billShort', { left: money(chosenBill.remainingMinor - minor) })}` : ''}
          </p>
        )}

        {draft.needsAttention && !bill && (
          <p className="flex items-center gap-1 text-[13.5px] font-semibold text-ink">
            <Icon name="alert" className="size-4 text-ink" />
            {t('check')}
          </p>
        )}
      </Card>
    );
  }

  return (
    <form ref={form} onSubmit={submit} className="space-y-4">
      <Card>
        <p className="text-[13.5px] text-muted">{t('youSaid')}</p>
        <p className="text-[15px]">“{transcript}”</p>
      </Card>

      {!mine && <Card className="text-[15px]">{t('notYours')}</Card>}

      {expenses.length > 0 && (
        <>
          <h2 className="text-[19px] font-bold">{t('spending')}</h2>
          {expenses.map(row)}
        </>
      )}

      {billRows.length > 0 && (
        <>
          <h2 className="text-[19px] font-bold">{t('bills')}</h2>
          {billRows.map(row)}
        </>
      )}

      {keeping.length === 0 && <Card className="text-[15px]">{t('allRemoved')}</Card>}

      {mine && (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 space-y-2 lg:bottom-4">
          <Button
            type="submit"
            size="lg"
            variant={keeping.length === 0 ? 'outline' : 'default'}
            className="w-full shadow-card"
            disabled={busy}
            data-testid={keeping.length === 0 ? 'voice-discard' : 'voice-confirm'}
          >
            {keeping.length === 0 ? t('discard') : t('addAll', { count: keeping.length })}
          </Button>
          {keeping.length > 0 && (
            <p className="rounded-chip bg-white/90 px-2 py-1 text-center text-[13.5px] text-muted">
              {t('split', { expenses: expenses.length, expenseTotal: money(expenseTotal), bills: billRows.length, billTotal: money(billTotal) })}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-chip bg-rani/10 px-3 py-2 text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
    </form>
  );
}
