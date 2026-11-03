import { MonthParam } from '@nestwise/api-contract';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatDay, formatMoney, toYm } from '@/client/format';
import { makeListLedgerUseCase } from '@/composition/activity';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { PageLoading } from '@/components/page-loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { moneyOf, pageContext } from '@/http/page-session';

type Search = Promise<{ month?: string; item?: string; person?: string; method?: string }>;
const METHODS = ['typed', 'voice', 'receipt'] as const;

export default function LedgerPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Ledger searchParams={searchParams} />
    </Suspense>
  );
}

/** The ledger (PRD §6.9): confirmed expenses, filtered by month, item, who paid and how they were added. */
async function Ledger({ searchParams }: { searchParams: Search }) {
  const { actor, family, current } = await pageContext();
  const t = await getTranslations('ledger');
  const money = moneyOf(family);
  const search = await searchParams;
  const month = MonthParam.safeParse(search.month);
  const period = month.success ? month.data : current;
  const method = METHODS.find((m) => m === search.method);
  const [entries, templates] = await Promise.all([
    makeListLedgerUseCase().execute({ actor, period, itemId: search.item || undefined, paidBy: search.person || undefined, captureMethod: method }),
    makeGetTemplatesUseCase().execute({ actor }),
  ]);
  const items = [...templates.monthly, ...templates.yearly];
  const itemName = new Map(items.map((i) => [i.itemId, i.name]));
  const payers = [...new Set(entries.map((e) => e.transaction.paidBy).filter((p): p is string => p !== null))];

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Card>
        <form className="grid grid-cols-2 gap-2" action="/ledger">
          <div>
            <Label htmlFor="month">{t('month')}</Label>
            <Input id="month" name="month" type="month" defaultValue={toYm(period)} />
          </div>
          <div>
            <Label htmlFor="item">{t('item')}</Label>
            <Select id="item" name="item" defaultValue={search.item ?? ''}>
              <option value="">{t('anyItem')}</option>
              {items.map((i) => (
                <option key={i.itemId} value={i.itemId}>
                  {i.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="person">{t('person')}</Label>
            <Select id="person" name="person" defaultValue={search.person ?? ''}>
              <option value="">{t('anyone')}</option>
              {payers.map((p) => (
                <option key={p} value={p}>
                  {t('payer', { who: p === actor.userId ? 'me' : 'other' })}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="method">{t('method')}</Label>
            <Select id="method" name="method" defaultValue={method ?? ''}>
              <option value="">{t('anyMethod')}</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {t('methods', { method: m })}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="col-span-2">
            {t('show')}
          </Button>
        </form>
      </Card>
      {entries.length === 0 && <Card>{t('empty')}</Card>}
      {entries.length > 0 && (
        <Card>
          <ul className="divide-y divide-zinc-100 text-sm">
            {entries.map(({ transaction: tx, proofs }) => (
              <li key={tx.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span>{tx.allocations.map((a) => itemName.get(a.itemId) ?? '').join(', ')}</span>
                  <span className="tabular-nums">
                    {tx.kind === 'refund' && '−'}
                    {formatMoney(tx.amountMinor, money.currency, money.minorUnit, money.locale)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {formatDay(tx.txnDate, money.locale)} · {t('entered', { who: tx.enteredBy === actor.userId ? 'me' : 'family' })} · {t('methods', { method: tx.captureMethod })} ·{' '}
                  {t('proofs', { count: proofs })}
                  {tx.merchant && ` · ${tx.merchant}`}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
