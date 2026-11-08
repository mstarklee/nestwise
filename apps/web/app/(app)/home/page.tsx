import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { maxClipSeconds, readProvider } from '@/capture/clip-limits';
import { greetingKey } from '@/client/greeting';
import { toYm } from '@/client/format';
import { systemClock } from '@/adapters/shared/system-clock';
import { makeGetHomeSummaryUseCase } from '@/composition/forecast';
import { makeListInboxUseCase } from '@/composition/duplicates';
import { MonthRow } from '@/components/month-row';
import { NavLink } from '@/components/nav-link';
import { PageLoading } from '@/components/page-loading';
import { QuickActions } from '@/components/quick-actions';
import { moneyOf, pageContext } from '@/http/page-session';
import { BiggestMonthCard } from './biggest-month';
import { BillsCard } from './bills-card';
import { MonthHeader } from './month-header';
import { OccasionalCards } from './occasional-cards';
import { PotCard } from './pot-card';
import { SetAsideCard } from './set-aside-card';
import { UndatedCard } from './undated-card';

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Home />
    </Suspense>
  );
}

/**
 * Home, bills first (design 2026-11-08): this month's plan and what is paid, this month's bills with done or not
 * done, what is set aside, then what is coming (the pot, the next three months, the biggest month). Everyday spending
 * lives on Budgets.
 */
async function Home() {
  const { user, actor, family, current, today } = await pageContext();
  const t = await getTranslations('home');
  const [home, inbox] = await Promise.all([makeGetHomeSummaryUseCase().execute({ actor }), makeListInboxUseCase().execute({ actor })]);
  const waitingCount = inbox.duplicates.length + inbox.captures.length;
  const money = moneyOf(family);
  const monthName = new Intl.DateTimeFormat(money.locale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(current.year, current.month - 1, 1));
  const initial = (user.email.trim()[0] ?? '?').toUpperCase();
  const canAnswer = actor.role !== 'viewer';

  return (
    <div className="pb-4">
      <MonthHeader
        greeting={greetingKey(systemClock.now(), family.timeZone)}
        familyName={family.name}
        initial={initial}
        inboxWaiting={waitingCount > 0}
        monthName={monthName}
        thisMonth={home.thisMonth}
        money={money}
      />

      <div className="mt-4 space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <div className="space-y-4">
          {canAnswer && <QuickActions withType maxSeconds={maxClipSeconds(readProvider(process.env.STT_PROVIDER))} />}
          <OccasionalCards cards={home.cards} current={current} locale={money.locale} waitingCount={waitingCount} />
          <BillsCard bills={home.thisMonth.bills} money={money} canAnswer={canAnswer} today={today} ym={toYm(current)} userId={actor.userId} />
          <SetAsideCard checklist={home.checklist} money={money} canAnswer={canAnswer} />
        </div>

        <div className="space-y-4">
          <section aria-labelledby="coming-up" className="space-y-4">
            <div className="flex items-baseline justify-between gap-2 px-1 pt-2">
              <h2 id="coming-up" className="font-display text-[20px] font-extrabold">
                {t('comingUp')}
              </h2>
              <NavLink href="/forecast" direction="tab" className="flex min-h-11 items-center text-[13.5px] font-bold text-peacock">
                {t('seeYear')}
              </NavLink>
            </div>
            <PotCard pot={home.pot} money={money} />
            <section className="rounded-card bg-white p-4 shadow-card" aria-labelledby="next-months">
              <h3 id="next-months" className="mb-1 font-display text-[19px] font-bold">
                {t('nextMonths')}
              </h3>
              <ul>
                {home.comingMonths.map((month) => (
                  <MonthRow key={`${month.period.year}-${month.period.month}`} month={month} isCurrent={false} money={money} />
                ))}
              </ul>
            </section>
            {home.biggestAhead && <BiggestMonthCard biggest={home.biggestAhead} potMinor={home.pot.balanceMinor} money={money} />}
            {home.undated
              .filter((u) => u.count > 0)
              .map((u) => (
                <UndatedCard key={u.year} undated={u} money={money} />
              ))}
          </section>
        </div>
      </div>
    </div>
  );
}
