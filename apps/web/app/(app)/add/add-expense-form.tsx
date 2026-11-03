'use client';

import { parseMinor, sumMinor } from '@nestwise/domain/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { api } from '@/client/api-client';
import { formatDay, formatMoney } from '@/client/format';
import { newId } from '@/client/new-id';
import { Button } from '@/components/ui/button';
import { DuplicateQuestion, type DuplicateQuestionProps } from '@/components/duplicate-question';
import { Card } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

type Money = { currency: string; minorUnit: number; locale: string };
type Group = { label: string; items: { id: string; name: string }[] };
type Other = { amountMinor: number; merchant: string | null; txnDate: string; enteredBy: string };
type RecordResponse = { transaction: { amountMinor: number }; duplicate: { matchId: string; other: Other } | null };

/** Amount → item → save (PRD §6.6). Splits add more parts; the parts must add up to the amount. */
export function AddExpenseForm({ today, money, monthly, yearly, userId }: { today: string; money: Money; monthly: Group[]; yearly: Group[]; userId: string }) {
  const t = useTranslations('add');
  const errorText = useErrorText();
  const router = useRouter();
  const [parts, setParts] = useState([{ key: 0, itemId: '', amount: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ amount: string; ym: string; question: DuplicateQuestionProps | null } | null>(null);
  const [busy, setBusy] = useState(false);
  // One id per entry, kept across retries so a resend is recognised (not saved twice).
  const id = useRef(newId());
  const unit = money.minorUnit as 0 | 1 | 2 | 3;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(null);
    let amountMinor: number;
    let allocations: { itemId: string; amountMinor: number }[];
    try {
      amountMinor = parseMinor(String(form.get('amount')), unit);
      allocations =
        parts.length === 1
          ? [{ itemId: parts[0]!.itemId, amountMinor }]
          : parts.map((p) => ({ itemId: p.itemId, amountMinor: parseMinor(p.amount, unit) }));
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
      const { transaction, duplicate } = await api<RecordResponse>('POST', '/api/v1/transactions', {
        id: id.current,
        kind: form.get('refund') === 'on' ? 'refund' : 'expense',
        amountMinor,
        txnDate,
        allocations,
        merchant: String(form.get('merchant')) || null,
        note: String(form.get('note')) || null,
      });
      const format = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
      const question: DuplicateQuestionProps | null = duplicate && {
        matchId: duplicate.matchId,
        amount: format(duplicate.other.amountMinor),
        shop: duplicate.other.merchant,
        day: formatDay(duplicate.other.txnDate, money.locale),
        mine: duplicate.other.enteredBy === userId,
        canPostpone: true,
      };
      setSaved({ amount: format(transaction.amountMinor), ym: txnDate.slice(0, 7), question });
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
        <optgroup key={`${group.label}-${g}`} label={g < monthly.length ? group.label : t('yearlyGroup', { group: group.label })}>
          {group.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );

  return (
    <form onSubmit={submit} className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Card className="space-y-4">
        <div>
          <Label htmlFor="amount">{t('amount')}</Label>
          <Input id="amount" name="amount" inputMode="decimal" autoComplete="off" required />
        </div>
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
        <Button type="button" size="sm" variant="ghost" onClick={() => setParts([...parts, { key: Date.now(), itemId: '', amount: '' }])}>
          {t('split')}
        </Button>
        <div>
          <Label htmlFor="date">{t('date')}</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div>
          <Label htmlFor="merchant">{t('merchant')}</Label>
          <Input id="merchant" name="merchant" maxLength={200} />
        </div>
        <div>
          <Label htmlFor="note">{t('note')}</Label>
          <Input id="note" name="note" maxLength={200} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="refund" className="size-4" /> {t('refund')}
        </label>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && !saved.question && (
        <p role="status" className="text-sm text-green-900">
          {t('saved', { amount: saved.amount })}{' '}
          <Link href={`/month/${saved.ym}`} className="underline">
            {t('seeMonth')}
          </Link>
        </p>
      )}
      {saved?.question && (
        <Card role="status" className="space-y-2">
          <p className="text-sm text-green-900">{t('savedMaybeRepeat', { amount: saved.amount })}</p>
          <DuplicateQuestion {...saved.question} onDone={() => setSaved({ ...saved, question: null })} />
        </Card>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {t('save')}
      </Button>
    </form>
  );
}
