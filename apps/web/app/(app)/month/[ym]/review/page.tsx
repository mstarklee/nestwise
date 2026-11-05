import { MonthParam } from '@nestwise/api-contract';
import { addMonths } from '@nestwise/domain/shared';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatPeriod, toYm } from '@/client/format';
import { makeGetMonthReviewUseCase } from '@/composition/month-review';
import { Icon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { PageLoading } from '@/components/page-loading';
import { DetailHeader } from '@/components/screen-header';
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
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader title={t('title', { month })} />

      <Card data-testid="review-headline">
        <p className="money text-[17px] font-semibold">
          {t('headline', { actual: exact(r.totals.actualMinor), planned: exact(r.totals.plannedMinor) })}{' '}
          {r.totals.varianceMinor !== 0 && t(r.totals.varianceMinor > 0 ? 'over' : 'under', { amount: exact(Math.abs(r.totals.varianceMinor)) })}
        </p>
      </Card>

      {(r.over.length > 0 || r.under.length > 0) && (
        <Card>
          <CardTitle>{t('overUnder')}</CardTitle>
          <ul className="divide-y divide-line">
            {[...r.over, ...r.under].map((l) => (
              <li key={l.itemId} className="flex items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 break-words font-semibold">{l.name}</span>
                <span className={`money flex shrink-0 items-center gap-1 font-semibold ${l.varianceMinor > 0 ? 'text-rani' : 'text-leaf'}`}>
                  <Icon name={l.varianceMinor > 0 ? 'alert' : 'check'} className="size-4" />
                  {signed(l.varianceMinor)} {t(l.varianceMinor > 0 ? 'overWord' : 'underWord')}
                </span>
              </li>
            ))}
          </ul>
          <NavLink href={`/month/${toYm(period)}`} direction="forward" className="mt-1 flex min-h-11 items-center text-[13.5px] font-bold text-peacock">
            {t('fullList')}
          </NavLink>
        </Card>
      )}

      {r.streaks.length > 0 && (
        <Card>
          {r.streaks.map((s) => (
            <div key={s.itemId} className="space-y-1">
              <p className="text-[15px]">{t('streak', { item: s.name, months: s.months })}</p>
              {isAdmin && <RaiseButton ym={toYm(next)} itemId={s.itemId} plannedMinor={s.suggestedMinor} label={t('raise', { month: formatPeriod(next, money.locale), amount: exact(s.suggestedMinor) })} />}
            </div>
          ))}
        </Card>
      )}

      <Card>
        <CardTitle>{t('bills')}</CardTitle>
        {r.billsPaid.length === 0 && r.billsUnpaid.length === 0 && <p className="text-muted">{t('noBills')}</p>}
        <ul className="space-y-1">
          {r.billsPaid.map((b) => (
            <li key={b.itemId}>{t('billPaid', { name: b.name, amount: exact(b.paidMinor) })}</li>
          ))}
          {r.billsUnpaid.map((b) => (
            <li key={b.lineId} className="flex items-center gap-1 font-semibold text-rani">
              <Icon name="alert" className="size-4 shrink-0" />
              {t('billUnpaid', { name: b.name, amount: exact(b.remainingMinor) })}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>{t('savings')}</CardTitle>
        <ul className="space-y-1">
          <li>{t('answer', { name: t('potDeposit'), answer: r.potDeposit })}</li>
          {r.savings.map((s) => (
            <li key={s.itemId}>{t('answer', { name: s.name, answer: s.answer })}</li>
          ))}
        </ul>
      </Card>

      {r.inboxCount > 0 && (
        <Card>
          <p className="text-[15px]">{t('inbox', { count: r.inboxCount })}</p>
          <NavLink href="/inbox" direction="forward" className="mt-1 flex min-h-11 items-center text-[13.5px] font-bold text-peacock">
            {t('openInbox')}
          </NavLink>
        </Card>
      )}

      {r.status === 'closed' ? (
        <p className="flex items-center gap-1 font-semibold text-leaf"><Icon name="check" className="size-5" />{t('closed', { month })}</p>
      ) : (
        isAdmin && <CloseMonthButton ym={toYm(period)} label={t('close', { month })} />
      )}
    </div>
  );
}
