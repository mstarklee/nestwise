'use client';

import { parseMinor, sumMinor } from '@nestwise/domain/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { formatDay, formatMoney } from '@/client/format';
import { newId } from '@/client/new-id';
import { saveExpense } from '@/client/save-expense';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/nav-link';
import { Sheet } from '@/components/sheet';
import { DuplicateQuestion, type DuplicateQuestionProps } from '@/components/duplicate-question';
import { Card } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

type Money = { currency: string; minorUnit: number; locale: string };
type Group = { label: string; items: { id: string; name: string }[] };
type Other = { amountMinor: number; merchant: string | null; txnDate: string; enteredBy: string };
type RecordResponse = { transaction: { amountMinor: number }; duplicate: { matchId: string; other: Other } | null };

/** A picked option: an item, or "itemId@2026" for last year's still-open bill (paid against that year's plan). */
function target(value: string): { itemId: string; planYear?: number } {
  const [itemId, year] = value.split('@');
  return year ? { itemId: itemId!, planYear: Number(year) } : { itemId: itemId! };
}

/** "2026-11-01" → "2026-10-31". */
function dayBefore(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! - 1)).toISOString().slice(0, 10);
}

/** Amount → item → save (PRD §6.6). Splits add more parts; the parts must add up to the amount. */
export function AddExpenseForm({ today, money, monthly, yearly, userId }: { today: string; money: Money; monthly: Group[]; yearly: Group[]; userId: string }) {
  const t = useTranslations('add');
  const tOutbox = useTranslations('outbox');
  const errorText = useErrorText();
  const router = useRouter();
  const [parts, setParts] = useState([{ key: 0, itemId: '', amount: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ amount: string; ym: string; question: DuplicateQuestionProps | null; onPhone: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // One id per entry, kept across retries so a resend is recognised (not saved twice).
  const id = useRef(newId());
  const dateInput = useRef<HTMLInputElement>(null);
  const unit = money.minorUnit as 0 | 1 | 2 | 3;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(null);
    let amountMinor: number;
    let allocations: { itemId: string; planYear?: number; amountMinor: number }[];
    try {
      amountMinor = parseMinor(String(form.get('amount')), unit);
      allocations =
        parts.length === 1
          ? [{ ...target(parts[0]!.itemId), amountMinor }]
          : parts.map((p) => ({ ...target(p.itemId), amountMinor: parseMinor(p.amount, unit) }));
    } catch {
      setError(t('badAmount'));
      return;
    }
    if (allocations.some((a) => a.itemId === '')) {
      setError(t('chooseItem'));
      return;
    }
    if (sumMinor(allocations.map((a) => a.amountMinor)) !== amountMinor) {
      setError(t('partsMustAddUp'));
      return;
    }
    const txnDate = String(form.get('date'));
    setBusy(true);
    try {
      // Every save goes to the phone's outbox first, then to the server: one path, signal or not.
      const body = {
        id: id.current,
        kind: form.get('refund') === 'on' ? 'refund' : 'expense',
        amountMinor,
        txnDate,
        allocations,
        merchant: String(form.get('merchant')) || null,
        note: String(form.get('note')) || null,
      };
      // A refusal is thrown: the person is right here, so the catch shows why and keeps what they typed.
      const saved = await saveExpense(userId, body);
      const response = saved.response as RecordResponse | undefined;
      const format = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
      const duplicate = response?.duplicate ?? null;
      const question: DuplicateQuestionProps | null = duplicate && {
        matchId: duplicate.matchId,
        amount: format(duplicate.other.amountMinor),
        shop: duplicate.other.merchant,
        day: formatDay(duplicate.other.txnDate, money.locale),
        mine: duplicate.other.enteredBy === userId,
        canPostpone: true,
      };
      setSaved({ amount: format(response?.transaction.amountMinor ?? amountMinor), ym: txnDate.slice(0, 7), question, onPhone: saved.onPhone });
      id.current = newId();
      formElement.reset();
      setParts([{ key: 0, itemId: '', amount: '' }]);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const itemSelect = (part: (typeof parts)[number], index: number) => (
    <Select
      aria-label={t('item')}
      value={part.itemId}
      onChange={(e) => setParts(parts.map((p, i) => (i === index ? { ...p, itemId: e.target.value } : p)))}
      required
    >
      <option value="">{t('chooseItem')}</option>
      {[...monthly, ...yearly].map((group, g) => (
        <optgroup key={`${group.label}-${g}`} label={g < monthly.length || group.items.some((i) => i.id.includes('@')) ? group.label : t('yearlyGroup', { group: group.label })}>
          {group.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );

  const sign = new Intl.NumberFormat(money.locale, { style: 'currency', currency: money.currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '';

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <Card>
        <Label htmlFor="amount">{t('amount')}</Label>
        <div className="flex items-center gap-2 rounded-chip focus-within:ring-2 focus-within:ring-peacock">
          <span aria-hidden="true" className="money pl-2 text-[30px] font-bold text-muted">
            {sign}
          </span>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            placeholder={t('amountPlaceholder')}
            className="money min-h-14 min-w-0 flex-1 rounded-chip bg-transparent px-0 text-[40px] font-extrabold leading-none"
          />
        </div>
      </Card>

      <Card className="space-y-3">
        {parts.map((part, index) => (
          <div key={part.key} className="flex gap-2">
            <div className="flex-1">{itemSelect(part, index)}</div>
            {parts.length > 1 && (
              <Input
                aria-label={t('partAmount')}
                inputMode="decimal"
                className="w-28"
                value={part.amount}
                onChange={(e) => setParts(parts.map((p, i) => (i === index ? { ...p, amount: e.target.value } : p)))}
              />
            )}
          </div>
        ))}
        <Button type="button" size="sm" variant="ghost" className="-ml-3" onClick={() => setParts([...parts, { key: Date.now(), itemId: '', amount: '' }])}>
          {t('split')}
        </Button>
        <div>
          <Label htmlFor="date">{t('date')}</Label>
          <div className="flex items-center gap-2">
            <Input id="date" name="date" type="date" defaultValue={today} required ref={dateInput} />
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-full bg-mist px-4 text-[13.5px] font-semibold text-peacock transition-transform active:scale-[.97] motion-reduce:transform-none"
              onClick={() => dateInput.current && (dateInput.current.value = dayBefore(today))}
            >
              {t('yesterday')}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="merchant">{t('merchant')}</Label>
          <Input id="merchant" name="merchant" maxLength={200} />
        </div>
        <div>
          <Label htmlFor="note">{t('note')}</Label>
          <Input id="note" name="note" maxLength={200} />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[13.5px] text-muted">
          <input type="checkbox" name="refund" className="size-5 accent-peacock" /> {t('refund')}
        </label>
      </Card>

      {error && (
        <p role="alert" className="rounded-chip bg-rani/10 px-3 py-2 text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 space-y-2 lg:bottom-4">
        {saved && saved.onPhone && (
          <p role="status" className="rounded-chip bg-leaf px-4 py-3 text-[14px] font-semibold text-white">
            {tOutbox('savedOnPhone', { amount: saved.amount })}
          </p>
        )}
        {saved && !saved.onPhone && (
          <p role="status" className="rounded-chip bg-leaf px-4 py-3 text-[14px] font-semibold text-white">
            {t('saved', { amount: saved.amount })}{' '}
            <NavLink href={`/month/${saved.ym}`} direction="forward" className="underline">
              {t('seeMonth')}
            </NavLink>
          </p>
        )}
        <Button type="submit" size="lg" className="w-full shadow-card" disabled={busy}>
          {t('save')}
        </Button>
      </div>

      <Sheet open={saved?.question != null} onClose={() => saved && setSaved({ ...saved, question: null })} title={t('sameTitle')}>
        {saved?.question && (
          <div className="space-y-3">
            <p className="text-[14px] text-muted">{t('savedMaybeRepeat', { amount: saved.amount })}</p>
            <DuplicateQuestion {...saved.question} onDone={() => setSaved({ ...saved, question: null })} />
          </div>
        )}
      </Sheet>
    </form>
  );
}
