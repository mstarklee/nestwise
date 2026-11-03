'use client';

import { parseMinor } from '@nestwise/domain/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/client/api-client';
import { formatMoney, minorToInput } from '@/client/format';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

type Money = { currency: string; minorUnit: number; locale: string };
type Entry = { itemId: string; name: string; amountMinor: number; dueMonth: number | null };

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const monthName = (m: number, locale: string) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2000, m - 1, 1));

function parseAmount(value: string, minorUnit: number): number {
  const trimmed = value.trim();
  return trimmed === '' || trimmed === '0' ? 0 : parseMinor(trimmed, minorUnit as 0 | 1 | 2 | 3);
}

export function TemplateItemEditor({
  entry,
  yearly,
  canEdit,
  money,
  futureMonths = [],
}: {
  entry: Entry;
  yearly: boolean;
  canEdit: boolean;
  money: Money;
  /** Months after this one that exist and may also take a new amount (PRD §6.2). */
  futureMonths?: { ym: string; label: string }[];
}) {
  const t = useTranslations('templates');
  const errorText = useErrorText();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = formatMoney(entry.amountMinor, money.currency, money.minorUnit, money.locale);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let amountMinor: number;
    try {
      amountMinor = parseAmount(String(form.get('amount')), money.minorUnit);
    } catch {
      setError(t('badAmount'));
      return;
    }
    const dueMonth = yearly && form.get('dueMonth') !== '' ? Number(form.get('dueMonth')) : null;
    try {
      await api('PATCH', `/api/v1/templates/items/${entry.itemId}`, {
        name: String(form.get('name')),
        // Fields left out are kept (hint range, due day); clearing the month also clears the day.
        template: { amountMinor, ...(yearly ? { dueMonth, ...(dueMonth === null ? { dueDay: null } : {}) } : {}) },
        applyToMonths: form.getAll('applyTo').map(String),
      });
      setEditing(false);
      setError(null);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function archive() {
    try {
      await api('POST', `/api/v1/templates/items/${entry.itemId}/archive`);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          {entry.name}
          {yearly && <span className="text-zinc-500"> · {entry.dueMonth === null ? t('noMonth') : monthName(entry.dueMonth, money.locale)}</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{amount}</span>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={t('editItem', { item: entry.name })}>
              {t('edit')}
            </Button>
          )}
        </span>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <Input name="name" defaultValue={entry.name} aria-label={t('name')} maxLength={80} required />
      <div className="flex gap-2">
        <Input name="amount" inputMode="decimal" defaultValue={minorToInput(entry.amountMinor, money.minorUnit)} aria-label={t('amount')} />
        {yearly && (
          <Select name="dueMonth" defaultValue={entry.dueMonth ?? ''} aria-label={t('dueMonth')}>
            <option value="">{t('noMonth')}</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {monthName(m, money.locale)}
              </option>
            ))}
          </Select>
        )}
      </div>
      {futureMonths.length > 0 && (
        <fieldset className="text-sm">
          <legend className="text-zinc-600">{t('alsoApply')}</legend>
          {futureMonths.map((m) => (
            <label key={m.ym} className="mr-3 inline-flex items-center gap-1">
              <input type="checkbox" name="applyTo" value={m.ym} className="size-4" /> {m.label}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          {t('save')}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
          {t('cancel')}
        </Button>
        <Button size="sm" type="button" variant="destructive" onClick={archive}>
          {t('archive')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

export function AddItemForm({ groupId, money }: { groupId: string; money: Money }) {
  const t = useTranslations('templates');
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let amountMinor: number;
    try {
      amountMinor = parseAmount(String(form.get('amount')), money.minorUnit);
    } catch {
      setError(t('badAmount'));
      return;
    }
    try {
      await api('POST', '/api/v1/templates/items', { groupId, name: String(form.get('name')), amountMinor });
      formElement.reset();
      setOpen(false);
      setError(null);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="mt-1" onClick={() => setOpen(true)}>
        {t('addItem')}
      </Button>
    );
  }
  return (
    <form onSubmit={add} className="mt-2 flex gap-2">
      <Input name="name" placeholder={t('name')} aria-label={t('name')} maxLength={80} required />
      <Input name="amount" inputMode="decimal" placeholder={t('amount')} aria-label={t('amount')} className="w-28" />
      <Button size="sm" type="submit">
        {t('add')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
