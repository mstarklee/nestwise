import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatMoneyRounded, formatPeriod } from '@/client/format';
import { makeGetForecastUseCase } from '@/composition/forecast';
import { Icon } from '@/components/icon';
import { MonthRow } from '@/components/month-row';
import { NavLink } from '@/components/nav-link';
import { mTag } from '@/components/num';
import { PageLoading } from '@/components/page-loading';
import { PotChart } from '@/components/pot-chart';
import { TabHeader } from '@/components/screen-header';
import { moneyOf, pageContext } from '@/http/page-session';

export default function ForecastPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Forecast />
    </Suspense>
  );
}

/** Twelve months of the pot: money in, yearly bills out, and the balance at each month's end (PRD 5.4). */
async function Forecast() {
  const { actor, family } = await pageContext();
  const t = await getTranslations('forecast');
  const f = await makeGetForecastUseCase().execute({ actor });
  const money = moneyOf(family);
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
  // This month's deposit may already be in (in = 0), so next month shows the monthly set-aside.
  const setAside = f.months[1]?.inMinor ?? 0;
  const covered = f.redMonths.length === 0;

  return (
    <>
      <TabHeader title={t('title')} />
      <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        <div className="space-y-4">
          <section className="on-peacock rounded-card bg-peacock-deep p-4 text-white">
            <p className="money text-[26px] font-extrabold leading-tight">{t('safeToSpend', { amount: rounded(f.safeToSpendNowMinor) })}</p>
            {covered ? (
              <p data-testid="no-red" className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold">
                <Icon name="check" className="size-4 shrink-0 text-gold" />
                {t('noRed')}
              </p>
            ) : (
              <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-chip bg-rani px-2.5 py-2 text-[14px] font-semibold">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                <span>
                  {t('redMonths', { months: f.redMonths.map((p) => formatPeriod(p, money.locale)).join(', ') })}{' '}
                  {f.fixPerMonthMinor !== null && t('fixPerMonth', { amount: rounded(f.fixPerMonthMinor) })}{' '}
                  {f.topUpNowMinor !== null && t('topUpNow', { amount: rounded(f.topUpNowMinor) })}
                </span>
              </p>
            )}
            <p className="mt-2 text-[13.5px] opacity-85">
              {t.rich('householdNeeds', { m: mTag,
                total: (rounded(f.monthlyPlanMinor + f.savingsPlanMinor + setAside)),
                spending: (rounded(f.monthlyPlanMinor)),
                savings: (rounded(f.savingsPlanMinor)),
                pot: (rounded(setAside)),
              })}
            </p>
          </section>

          <section className="rounded-card bg-white p-4 shadow-card">
            <PotChart months={f.months} money={money} />
          </section>

          {f.undated.map((u) => (
            <section key={u.year} className="rounded-card bg-white p-4 shadow-card">
              <h2 className="mb-2 text-[19px] font-bold">{t('undatedTitle', { year: u.year, count: u.count, amount: rounded(u.totalMinor) })}</h2>
              <ul className="divide-y divide-line">
                {u.lines.map((line) => (
                  <li key={line.yearLineId} className="flex items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0 break-words font-semibold">{line.name}</span>
                    <span className="money shrink-0">{exact(line.remainingMinor)}</span>
                  </li>
                ))}
              </ul>
              <NavLink
                href={`/year/${u.year}`}
                direction="forward"
                className="mt-3 flex min-h-11 items-center justify-center rounded-action bg-peacock px-4 font-semibold text-white transition-transform active:scale-[.97] motion-reduce:transform-none"
              >
                {t('giveMonths')}
              </NavLink>
            </section>
          ))}
        </div>

        <section className="rounded-card bg-white p-4 shadow-card">
          <ul data-testid="forecast-months">
            {f.months.map((m, i) => (
              <MonthRow
                key={`${m.period.year}-${m.period.month}`}
                month={{ ...f.bills[i]!, endMinor: m.endMinor }}
                isCurrent={i === 0}
                money={money}
                detail={
                  <>
                    <p className="money text-[13.5px] text-muted">{t.rich('detail', { m: mTag, inAmount: (rounded(m.inMinor)), outAmount: (rounded(m.outMinor)), endAmount: (rounded(m.endMinor)) })}</p>
                    {m.estimate ? <p className="text-[13.5px] text-muted">{t('estimateNote')}</p> : null}
                  </>
                }
              />
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
