import { addMonths } from '@nestwise/domain/shared';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatMoneyRounded, formatPeriod, toYm } from '@/client/format';
import { makeGetHomeSummaryUseCase } from '@/composition/forecast';
import { makeListInboxUseCase } from '@/composition/duplicates';
import { makeGetChecklistUseCase } from '@/composition/pot';
import { PageLoading } from '@/components/page-loading';
import { Card, CardTitle } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';
import { ChecklistCard } from './checklist-card';

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const { actor, family, current } = await pageContext();
  const t = await getTranslations('home');
  const tStatus = await getTranslations('status');
  const [home, checklist, inbox] = await Promise.all([
    makeGetHomeSummaryUseCase().execute({ actor }),
    makeGetChecklistUseCase().execute({ actor, period: current }),
    makeListInboxUseCase().execute({ actor }),
  ]);
  const money = moneyOf(family);
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);

  return (
    <div className="space-y-4 py-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{family.name}</h1>
        <Link href="/settings/account" className="text-sm text-zinc-600 underline">
          {t('settings')}
        </Link>
      </header>

      <Card aria-labelledby="pot-title">
        <h2 id="pot-title" className="text-sm text-zinc-600">
          {t('pot')}
        </h2>
        <p data-testid="pot-balance" className={`text-3xl font-semibold tabular-nums ${home.pot.balanceMinor < 0 ? 'text-red-700' : ''}`}>
          {rounded(home.pot.balanceMinor)}
        </p>
        <p className="mt-1 text-sm text-zinc-600">{t('safeToSpend', { amount: rounded(home.pot.safeToSpendNowMinor) })}</p>
        {home.pot.firstRed && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {t('shortBy', { amount: rounded(home.pot.firstRed.shortfallMinor), month: formatPeriod(home.pot.firstRed.period, money.locale) })}{' '}
            {home.pot.fixPerMonthMinor !== null && t('fixPerMonth', { amount: rounded(home.pot.fixPerMonthMinor) })}
          </p>
        )}
      </Card>

      {home.cards.includes('month_review') && (
        <Card>
          <p className="text-sm">{t('monthReview', { month: formatPeriod(addMonths(current, -1), money.locale) })}</p>
          <Link href={`/month/${toYm(addMonths(current, -1))}/review`} className="mt-1 block text-sm text-green-900 underline">
            {t('openReview')}
          </Link>
        </Card>
      )}

      {inbox.length > 0 && (
        <Card>
          <p className="text-sm">{t('inboxCount', { count: inbox.length })}</p>
          <Link href="/inbox" className="mt-1 block text-sm text-green-900 underline">
            {t('openInbox')}
          </Link>
        </Card>
      )}

      {home.cards.includes('checklist') && <ChecklistCard checklist={checklist} money={money} canAnswer={actor.role !== 'viewer'} />}

      <Card>
        <CardTitle>{t('nextBills')}</CardTitle>
        <ul className="space-y-3">
          {home.next3Months.map((month) => (
            <li key={`${month.period.year}-${month.period.month}`}>
              <p className="text-sm font-medium text-zinc-600">{formatPeriod(month.period, money.locale)}</p>
              {month.lines.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('noBills')}</p>
              ) : (
                <ul>
                  {month.lines.map((line) => (
                    <li key={`${line.yearLineId ?? line.name}`} className="flex justify-between text-sm">
                      <span>
                        {line.name} <span className="text-zinc-500">· {tStatus(line.status)}</span>
                      </span>
                      <span className="tabular-nums">{exact(line.remainingMinor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <Link href="/forecast" className="mt-3 block text-sm text-green-900 underline">
          {t('seeForecast')}
        </Link>
      </Card>

      <Card>
        <CardTitle>{formatPeriod(current, money.locale)}</CardTitle>
        <p className="text-sm">
          {t('spent', { actual: rounded(home.thisMonth.actualMinor), planned: rounded(home.thisMonth.plannedMinor) })}
        </p>
        {home.thisMonth.groupsOver.length > 0 && (
          <p className="mt-1 text-sm text-red-700">{t('groupsOver', { groups: home.thisMonth.groupsOver.join(', ') })}</p>
        )}
        <Link href={`/month/${current.year}-${String(current.month).padStart(2, '0')}`} className="mt-2 block text-sm text-green-900 underline">
          {t('seeMonth')}
        </Link>
      </Card>

      {home.undated.map((u) => (
        <Card key={u.year}>
          <p className="text-sm">{t('undated', { count: u.count, amount: rounded(u.totalMinor), year: u.year })}</p>
          <Link href={`/year/${u.year}`} className="mt-1 block text-sm text-green-900 underline">
            {t('giveMonths')}
          </Link>
        </Card>
      ))}
    </div>
  );
}
