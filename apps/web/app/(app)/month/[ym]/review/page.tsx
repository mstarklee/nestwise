import { MonthParam } from '@nestwise/api-contract';
import { addMonths } from '@nestwise/domain/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatPeriod, toYm } from '@/client/format';
import { makeGetMonthReviewUseCase } from '@/composition/month-review';
import { PageLoading } from '@/components/page-loading';
import { Card, CardTitle } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';
import { CloseMonthButton, RaiseButton } from './review-actions';

type Params = Promise<{ ym: string }>;

export default function MonthReviewPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Review params={params} />
    </Suspense>
  );
}

/** The month-end review (PRD §6.12): one screen for the month just ended, closed with one tap. */
async function Review({ params }: { params: Params }) {
  const parsed = MonthParam.safeParse((await params).ym);
  if (!parsed.success) notFound();
  const period = parsed.data;
  const { actor, family } = await pageContext();
  const t = await getTranslations('review');
  const money = moneyOf(family);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
  const signed = (minor: number) => `${minor > 0 ? '+' : '−'}${exact(Math.abs(minor))}`;
  const r = await makeGetMonthReviewUseCase().execute({ actor, period });
  const month = formatPeriod(period, money.locale);
  const next = addMonths(period, 1);
  const isAdmin = actor.role === 'admin';

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title', { month })}</h1>

      <Card data-testid="review-headline">
        <p className="tabular-nums">
          {t('headline', { actual: exact(r.totals.actualMinor), planned: exact(r.totals.plannedMinor) })}{' '}
          {r.totals.varianceMinor !== 0 && t(r.totals.varianceMinor > 0 ? 'over' : 'under', { amount: exact(Math.abs(r.totals.varianceMinor)) })}
        </p>
      </Card>

      {(r.over.length > 0 || r.under.length > 0) && (
        <Card>
          <CardTitle>{t('overUnder')}</CardTitle>
          <ul className="divide-y divide-zinc-100 text-sm">
            {[...r.over, ...r.under].map((l) => (
              <li key={l.itemId} className="flex justify-between py-1">
                <span>{l.name}</span>
                <span className={l.varianceMinor > 0 ? 'text-red-700 tabular-nums' : 'text-green-900 tabular-nums'}>{signed(l.varianceMinor)}</span>
              </li>
            ))}
          </ul>
          <Link href={`/month/${toYm(period)}`} className="mt-2 block text-sm text-green-900 underline">
            {t('fullList')}
          </Link>
        </Card>
      )}

      {r.streaks.length > 0 && (
        <Card>
          {r.streaks.map((s) => (
            <div key={s.itemId} className="space-y-1">
              <p className="text-sm">{t('streak', { item: s.name, months: s.months })}</p>
              {isAdmin && <RaiseButton ym={toYm(next)} itemId={s.itemId} plannedMinor={s.suggestedMinor} label={t('raise', { month: formatPeriod(next, money.locale), amount: exact(s.suggestedMinor) })} />}
            </div>
          ))}
        </Card>
      )}

      <Card>
        <CardTitle>{t('bills')}</CardTitle>
        {r.billsPaid.length === 0 && r.billsUnpaid.length === 0 && <p className="text-sm text-zinc-600">{t('noBills')}</p>}
        <ul className="text-sm">
          {r.billsPaid.map((b) => (
            <li key={b.itemId}>{t('billPaid', { name: b.name, amount: exact(b.paidMinor) })}</li>
          ))}
          {r.billsUnpaid.map((b) => (
            <li key={b.lineId} className="text-red-700">
              {t('billUnpaid', { name: b.name, amount: exact(b.remainingMinor) })}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>{t('savings')}</CardTitle>
        <ul className="text-sm">
          <li>{t('answer', { name: t('potDeposit'), answer: r.potDeposit })}</li>
          {r.savings.map((s) => (
            <li key={s.itemId}>{t('answer', { name: s.name, answer: s.answer })}</li>
          ))}
        </ul>
      </Card>

      {r.inboxCount > 0 && (
        <Card>
          <p className="text-sm">{t('inbox', { count: r.inboxCount })}</p>
          <Link href="/inbox" className="mt-1 block text-sm text-green-900 underline">
            {t('openInbox')}
          </Link>
        </Card>
      )}

      {r.status === 'closed' ? (
        <p className="text-sm text-zinc-600">{t('closed', { month })}</p>
      ) : (
        isAdmin && <CloseMonthButton ym={toYm(period)} label={t('close', { month })} />
      )}
    </div>
  );
}
