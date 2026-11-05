import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { greetingKey } from '@/client/greeting';
import { formatMoneyRounded, toYm } from '@/client/format';
import { systemClock } from '@/adapters/shared/system-clock';
import { makeGetHomeSummaryUseCase } from '@/composition/forecast';
import { makeListInboxUseCase } from '@/composition/duplicates';
import { MonthRow } from '@/components/month-row';
import { NavLink } from '@/components/nav-link';
import { mTag } from '@/components/num';
import { PageLoading } from '@/components/page-loading';
import { QuickActions } from '@/components/quick-actions';
import { SpendingRings } from '@/components/spending-rings';
import { moneyOf, pageContext } from '@/http/page-session';
import { BiggestMonthCard } from './biggest-month';
import { ChecklistCard } from './checklist-card';
import { OccasionalCards } from './occasional-cards';
import { PotHeader } from './pot-header';
import { UndatedCard } from './undated-card';

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const { user, actor, family, current } = await pageContext();
  const t = await getTranslations('home');
  const [home, inbox] = await Promise.all([makeGetHomeSummaryUseCase().execute({ actor }), makeListInboxUseCase().execute({ actor })]);
  const waitingCount = inbox.duplicates.length + inbox.captures.length;
  const money = moneyOf(family);
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const monthName = new Intl.DateTimeFormat(money.locale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(current.year, current.month - 1, 1));
  const initial = (user.email.trim()[0] ?? '?').toUpperCase();

  return (
    <div className="pb-4">
      <PotHeader
        greeting={greetingKey(systemClock.now(), family.timeZone)}
        familyName={family.name}
        initial={initial}
        inboxWaiting={waitingCount > 0}
        pot={home.pot}
        money={money}
      />

      <div className="mt-4 space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <div className="space-y-4">
          {actor.role !== 'viewer' && <QuickActions withType />}

          <section className="rounded-card bg-white p-4 shadow-card" aria-labelledby="next-months">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 id="next-months" className="text-[19px] font-bold">
                {t('nextMonths')}
              </h2>
              <NavLink href="/forecast" direction="tab" className="flex min-h-11 items-center text-[13.5px] font-semibold text-peacock">
                {t('seeYear')}
              </NavLink>
            </div>
            <ul>
              {home.next3Months.map((month, i) => (
                <MonthRow key={`${month.period.year}-${month.period.month}`} month={month} isCurrent={i === 0} money={money} />
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <OccasionalCards cards={home.cards} current={current} locale={money.locale} waitingCount={waitingCount} />
          {home.cards.includes('checklist') && <ChecklistCard checklist={home.checklist} money={money} canAnswer={actor.role !== 'viewer'} />}
          {home.biggestAhead && <BiggestMonthCard biggest={home.biggestAhead} potMinor={home.pot.balanceMinor} money={money} />}
          {home.undated.filter((u) => u.count > 0).map((u) => (
            <UndatedCard key={u.year} undated={u} money={money} />
          ))}

          <section className="rounded-card bg-white p-4 shadow-card" aria-labelledby="spending">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 id="spending" className="text-[20px] font-extrabold">
                {t('spending.title', { month: monthName })}
              </h2>
              <NavLink href={`/month/${toYm(current)}`} direction="tab" className="flex min-h-11 items-center text-[13.5px] font-bold text-peacock">
                {t('spending.open')}
              </NavLink>
            </div>
            <p className="mb-3 text-[14px] text-muted" data-testid="month-summary">
              {t.rich('spending.summary', { m: mTag, actual: (rounded(home.thisMonth.actualMinor)), planned: (rounded(home.thisMonth.plannedMinor)) })}
            </p>
            <SpendingRings groups={home.thisMonth.groups} alertThresholds={family.alertThresholds} money={money} />
          </section>
        </div>
      </div>
    </div>
  );
}
