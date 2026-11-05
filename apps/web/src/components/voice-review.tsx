'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { api } from '@/client/api-client';
import { formatMoney } from '@/client/format';
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
  function typedAmounts(): Record<string, string> {
    const element = form.current;
    if (!element) return shown;
    const data = new FormData(element);
    return Object.fromEntries(drafts.map((d) => [d.id, String(data.get(`amount-${d.id}`) ?? shown[d.id] ?? '')]));
  }

  const keeping = drafts.filter((d) => !d.dropped);
  const expenses = keeping.filter((d) => d.kind === 'expense');
  const billRows = keeping.filter((d) => d.kind === 'yearly_bill');
  const shownMinor = (d: Draft) => toMinor(shown[d.id] ?? '') ?? 0;
  const expenseTotal = expenses.reduce((sum, d) => sum + shownMinor(d), 0);
  const billTotal = billRows.reduce((sum, d) => sum + shownMinor(d), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = typedAmounts();
    const unready = keeping.filter((d) => toMinor(typed[d.id] ?? '') === null || (d.kind === 'expense' ? !d.itemId : !d.yearLineId));
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
          amountMinor: toMinor(typed[d.id] ?? '') ?? 1,
          itemId: d.kind === 'expense' ? d.itemId : null,
          yearLineId: d.kind === 'yearly_bill' ? d.yearLineId : null,
          kind: d.kind,
          txnDate: d.txnDate,
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
        className={`space-y-2 ${bill ? 'border-sky-300 bg-sky-50' : draft.needsAttention ? 'border-amber-400 bg-amber-50' : ''}`}
      >
        <p className="text-xs text-zinc-600">“{draft.heard}”</p>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={t('amount')}
            name={`amount-${draft.id}`}
            inputMode="decimal"
            autoComplete="off"
            className="w-28"
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

          <Button type="button" size="sm" variant="ghost" onClick={() => update(draft.id, { dropped: true })}>
            {t('remove')}
          </Button>
        </div>

        <p className="text-xs text-zinc-500">
          {draft.merchant ? `${draft.merchant} · ` : ''}
          {draft.txnDate}
        </p>

        {bill && chosenBill && minor > 0 && (
          <p className="text-xs text-sky-900" data-testid="voice-bill-effect">
            {t('billEffect', { before: money(potBalanceMinor), after: money(potBalanceMinor - minor) })}
            {short ? ` · ${t('billShort', { left: money(chosenBill.remainingMinor - minor) })}` : ''}
          </p>
        )}

        {draft.needsAttention && !bill && <p className="text-xs font-medium text-amber-900">{t('check')}</p>}
      </Card>
    );
  }

  return (
    <form ref={form} onSubmit={submit} className="space-y-4">
      <Card className="bg-zinc-50">
        <p className="text-xs text-zinc-500">{t('youSaid')}</p>
        <p className="text-sm">“{transcript}”</p>
      </Card>

      {!mine && <Card className="text-sm">{t('notYours')}</Card>}

      {expenses.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t('spending')}</h2>
          {expenses.map(row)}
        </>
      )}

      {billRows.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t('bills')}</h2>
          {billRows.map(row)}
        </>
      )}

      {keeping.length === 0 && <Card className="text-sm">{t('allRemoved')}</Card>}

      {mine && keeping.length > 0 && (
        <div className="space-y-2">
          <Button type="submit" size="lg" className="w-full" disabled={busy} data-testid="voice-confirm">
            {t('addAll', { count: keeping.length })}
          </Button>
          <p className="text-center text-xs text-zinc-500">
            {t('split', { expenses: expenses.length, expenseTotal: money(expenseTotal), bills: billRows.length, billTotal: money(billTotal) })}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
