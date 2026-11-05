import { MonthParam } from '@nestwise/api-contract';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatDay, formatMoney, formatPeriod, toYm } from '@/client/format';
import { iconFor } from '@/client/group-icon';
import { makeListLedgerUseCase } from '@/composition/activity';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { Icon, type FrameIcon } from '@/components/icon';
import { PageLoading } from '@/components/page-loading';
import { DetailHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { moneyOf, pageContext } from '@/http/page-session';

type Search = Promise<{ month?: string; item?: string; person?: string; method?: string }>;
const METHODS = ['typed', 'voice', 'receipt'] as const;
const METHOD_ICON: Record<string, FrameIcon> = { typed: 'type', voice: 'mic', receipt: 'scan' };

export default function LedgerPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Ledger searchParams={searchParams} />
    </Suspense>
  );
}

const CHIP = 'inline-flex min-h-8 items-center rounded-full bg-white px-3 text-[13.5px] font-semibold text-peacock shadow-card';

/** The ledger (PRD 6.9): confirmed expenses, filtered by month, item, who paid and how they were added. */
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
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader title={t('title')} />

      <ul className="flex flex-wrap gap-2" aria-label={t('filters')}>
        <li className={CHIP}>{formatPeriod(period, money.locale)}</li>
        {search.item ? <li className={CHIP}>{itemName.get(search.item) ?? t('anyItem')}</li> : null}
        {method ? <li className={CHIP}>{t('methods', { method })}</li> : null}
      </ul>

      <section className="rounded-card bg-white p-4 shadow-card">
        <form className="grid grid-cols-2 gap-3" action="/ledger">
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
      </section>

      {entries.length === 0 && <p className="rounded-card bg-white p-4 shadow-card">{t('empty')}</p>}
      {entries.length > 0 && (
        <section className="rounded-card bg-white p-4 shadow-card">
          <ul>
            {entries.map(({ transaction: tx, proofs }) => {
              const names = tx.allocations.map((a) => itemName.get(a.itemId) ?? '').join(', ');
              return (
                <li key={tx.id} className="border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Icon name={iconFor(names)} className="size-5 shrink-0 text-peacock" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">{tx.merchant ? tx.merchant : names}</p>
                      {tx.merchant ? <p className="break-words text-[13.5px] text-muted">{names}</p> : null}
                    </div>
                    <span className={`money shrink-0 font-semibold ${tx.kind === 'refund' ? 'text-leaf' : ''}`}>
                      {tx.kind === 'refund' && '−'}
                      {formatMoney(tx.amountMinor, money.currency, money.minorUnit, money.locale)}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-7 text-[13.5px] text-muted">
                    <span>{formatDay(tx.txnDate, money.locale)}</span>
                    <span>{t('entered', { who: tx.enteredBy === actor.userId ? 'me' : 'family' })}</span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name={METHOD_ICON[tx.captureMethod] ?? 'type'} className="size-4" />
                      {t('methods', { method: tx.captureMethod })}
                    </span>
                    <span>{t('proofs', { count: proofs })}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
