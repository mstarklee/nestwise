'use client';

import type { HomeBill, HomeBills } from '@nestwise/domain/forecast';
import { parseMinor } from '@nestwise/domain/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useRef, useState } from 'react';
import { api } from '@/client/api-client';
import { formatDay, formatMoney, formatMoneyRounded, minorToInput } from '@/client/format';
import { iconFor } from '@/client/group-icon';
import { newId } from '@/client/new-id';
import { saveExpense } from '@/client/save-expense';
import { Icon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { mTag } from '@/components/num';
import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Input, Label } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';
import type { Money } from '@/http/page-session';

type Props = {
  bills: HomeBills;
  money: Money;
  /** Admins and Members can mark bills paid; Viewers only look. */
  canAnswer: boolean;
  /** Today in the family's time zone, "YYYY-MM-DD": the date a bill is marked paid on unless changed. */
  today: string;
  /** This month as "YYYY-MM", for "Not this month". */
  ym: string;
  userId: string;
};

/**
 * This month's bills (design 2026-11-08 §3–4): still to pay, then paid, each with done or not done. "Mark paid"
 * records an ordinary expense for the bill, through the phone's outbox like Add.
 */
export function BillsCard({ bills, money, canAnswer, today, ym, userId }: Props) {
  const t = useTranslations('home.bills');
  const [open, setOpen] = useState<HomeBill | null>(null);
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const toPay = bills.lines.filter((b) => b.state === 'to_pay');
  const paid = bills.lines.filter((b) => b.state === 'paid');
  const skipped = bills.lines.filter((b) => b.state === 'not_this_month');
  const paidTotal = paid.reduce((sum, b) => sum + b.paidMinor, 0);

  return (
    <Card aria-labelledby="bills-title" data-testid="bills-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="bills-title" className="font-display text-[19px] font-bold leading-tight">
          {t('title')}
        </h2>
        {bills.count > 0 && <span className="whitespace-nowrap text-[13.5px] font-bold text-peacock">{t('count', { paid: bills.paidCount, count: bills.count })}</span>}
      </div>

      {bills.lines.length === 0 && (
        <div className="mt-2 space-y-2 text-[14px] text-muted">
          <p>{t('empty')}</p>
          <NavLink href="/templates" direction="forward" className="inline-flex min-h-11 items-center font-semibold text-peacock">
            {t('openPlan')}
          </NavLink>
        </div>
      )}

      {toPay.length > 0 && (
        <Group label={t.rich('toPay', { m: mTag, amount: rounded(bills.toPayMinor) })}>
          {toPay.map((bill) => (
            <BillRow key={key(bill)} bill={bill} money={money} canAnswer={canAnswer} onMarkPaid={() => setOpen(bill)} />
          ))}
        </Group>
      )}
      {paid.length > 0 && (
        <Group label={t.rich('paid', { m: mTag, amount: rounded(paidTotal) })}>
          {paid.map((bill) => (
            <BillRow key={key(bill)} bill={bill} money={money} canAnswer={false} onMarkPaid={() => undefined} />
          ))}
        </Group>
      )}
      {skipped.length > 0 && (
        <Group label={t('notThisMonthGroup')}>
          {skipped.map((bill) => (
            <BillRow key={key(bill)} bill={bill} money={money} canAnswer={false} onMarkPaid={() => undefined} />
          ))}
        </Group>
      )}

      <MarkPaidSheet bill={open} onClose={() => setOpen(null)} money={money} today={today} ym={ym} userId={userId} />
    </Card>
  );
}

const key = (bill: HomeBill) => `${bill.kind}:${bill.yearLineId ?? bill.itemId}`;

function Group({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-[12.5px] font-bold uppercase tracking-[.04em] text-muted">{label}</p>
      <ul className="divide-y divide-line">{children}</ul>
    </div>
  );
}

function BillRow({ bill, money, canAnswer, onMarkPaid }: { bill: HomeBill; money: Money; canAnswer: boolean; onMarkPaid: () => void }) {
  const t = useTranslations('home.bills');
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const isPaid = bill.state === 'paid';
  const amount = bill.state === 'to_pay' ? bill.toPayMinor : isPaid ? bill.paidMinor : null;
  const difference = bill.kind === 'monthly' && isPaid ? bill.paidMinor - bill.plannedMinor : 0;
  return (
    <li className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5 py-2.5" data-testid="bill-row" data-state={bill.state}>
      <span
        aria-hidden="true"
        className={cn(
          'grid size-10 place-items-center rounded-[13px]',
          isPaid ? 'bg-leaf/10 text-leaf' : bill.kind === 'yearly' ? 'bg-gold/25 text-ink' : 'bg-peacock/10 text-peacock',
        )}
      >
        <Icon name={isPaid ? 'check' : iconFor(bill.name)} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className={cn('text-[15px] font-semibold leading-tight', bill.state !== 'to_pay' && 'text-muted')}>{bill.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-muted">
          {bill.kind === 'yearly' && <span className="rounded-full bg-gold px-2 font-bold text-ink">{t('yearly')}</span>}
          {bill.overdue && <span className="rounded-full bg-rani px-2 font-bold text-white">{t('overdue')}</span>}
          {isPaid ? (
            <span className="font-semibold text-leaf">
              {bill.paidOn ? t('paidOn', { day: formatDay(bill.paidOn, money.locale) }) : t('paidNoDate')}
              {difference < 0 && <> · {t.rich('under', { m: mTag, amount: rounded(-difference) })}</>}
              {difference > 0 && <> · {t.rich('over', { m: mTag, amount: rounded(difference) })}</>}
            </span>
          ) : bill.state === 'not_this_month' ? (
            <span>{t('notThisMonth')}</span>
          ) : bill.kind === 'yearly' ? (
            bill.paidMinor > 0 ? <span>{t.rich('paidSoFar', { m: mTag, amount: rounded(bill.paidMinor) })}</span> : null
          ) : (
            <span>{t('everyMonth')}</span>
          )}
        </p>
      </div>
      <div className="grid justify-items-end gap-1">
        {amount !== null && <span className={cn('money text-[15.5px] font-bold', isPaid && 'text-muted')}>{rounded(amount)}</span>}
        {canAnswer && bill.state === 'to_pay' && (
          <button
            type="button"
            onClick={onMarkPaid}
            aria-label={t('markPaidFor', { item: bill.name })}
            className="relative whitespace-nowrap rounded-full bg-peacock px-3 py-1 text-[12.5px] font-bold text-white transition-transform after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] active:scale-[.97] motion-reduce:transform-none"
          >
            {t('markPaid')}
          </button>
        )}
      </div>
    </li>
  );
}

/** The amount (what is owed, filled in), the date (today), then Save; a monthly bill can also be "not this month". */
function MarkPaidSheet({ bill, onClose, money, today, ym, userId }: { bill: HomeBill | null; onClose: () => void; money: Money; today: string; ym: string; userId: string }) {
  const t = useTranslations('home.bills.sheet');
  return (
    <Sheet open={bill !== null} onClose={onClose} title={bill ? t('title', { item: bill.name }) : ''}>
      {bill && <MarkPaidForm key={key(bill)} bill={bill} onClose={onClose} money={money} today={today} ym={ym} userId={userId} />}
    </Sheet>
  );
}

function MarkPaidForm({ bill, onClose, money, today, ym, userId }: { bill: HomeBill; onClose: () => void; money: Money; today: string; ym: string; userId: string }) {
  const t = useTranslations('home.bills.sheet');
  const errorText = useErrorText();
  const router = useRouter();
  const [amount, setAmount] = useState(minorToInput(bill.toPayMinor, money.minorUnit));
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // One id per payment, kept across retries so a resend is recognised (not saved twice).
  const id = useRef(newId());

  async function save() {
    let amountMinor: number;
    try {
      amountMinor = parseMinor(amount, money.minorUnit as 0 | 1 | 2 | 3);
      if (amountMinor <= 0) throw new Error('not positive');
    } catch {
      setError(t('badAmount'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveExpense(userId, {
        id: id.current,
        kind: 'expense',
        amountMinor,
        txnDate: date,
        allocations: [{ itemId: bill.itemId, amountMinor, ...(bill.planYear !== null ? { planYear: bill.planYear } : {}) }],
        merchant: null,
        note: null,
      });
      const response = saved.response as { duplicate?: unknown } | undefined;
      router.refresh();
      if (saved.onPhone) setNotice(t('onPhone'));
      else if (response?.duplicate) setNotice(t('inInbox'));
      else onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function notThisMonth() {
    setBusy(true);
    setError(null);
    try {
      await api('PUT', `/api/v1/months/${ym}/lines/${bill.itemId}`, { plannedMinor: 0 });
      router.refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  if (notice) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-[15px]">
          {notice}
        </p>
        <Button className="w-full" onClick={onClose}>
          {t('ok')}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-[14px] text-muted">{bill.kind === 'yearly' ? t('fromPot') : t('explain')}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bill-amount">{t('amount')}</Label>
          <Input
            id="bill-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={formatMoney(bill.toPayMinor, money.currency, money.minorUnit, money.locale)}
          />
        </div>
        <div>
          <Label htmlFor="bill-date">{t('date')}</Label>
          <Input id="bill-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {t('save')}
      </Button>
      <div className="flex gap-2">
        {bill.kind === 'monthly' && (
          <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => void notThisMonth()}>
            {t('notThisMonth')}
          </Button>
        )}
        <Button type="button" variant="ghost" className="flex-1" disabled={busy} onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
