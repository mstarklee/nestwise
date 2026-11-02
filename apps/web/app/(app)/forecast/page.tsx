import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatMoneyRounded, formatMonthShort, formatPeriod } from '@/client/format';
import { makeGetForecastUseCase } from '@/composition/forecast';
import { PageLoading } from '@/components/page-loading';
import { Card, CardTitle } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';

export default function ForecastPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Forecast />
    </Suspense>
  );
}

/** Twelve months of the pot: money in, yearly bills out, and the balance at each month's end (PRD §5.4). */
async function Forecast() {
  const { actor, family } = await pageContext();
  const t = await getTranslations('forecast');
  const tStatus = await getTranslations('status');
  const f = await makeGetForecastUseCase().execute({ actor });
  const money = moneyOf(family);
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
  // This month's deposit may already be in (in = 0), so next month shows the monthly set-aside.
  const setAside = f.months[1]?.inMinor ?? 0;

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Card>
        <p>{t('safeToSpend', { amount: rounded(f.safeToSpendNowMinor) })}</p>
        {f.redMonths.length === 0 ? (
          <p data-testid="no-red" className="text-sm text-green-900">
            {t('noRed')}
          </p>
        ) : (
          <p role="alert" className="text-sm text-red-700">
            {t('redMonths', { months: f.redMonths.map((p) => formatPeriod(p, money.locale)).join(', ') })}{' '}
            {f.fixPerMonthMinor !== null && t('fixPerMonth', { amount: rounded(f.fixPerMonthMinor) })}{' '}
            {f.topUpNowMinor !== null && t('topUpNow', { amount: rounded(f.topUpNowMinor) })}
          </p>
        )}
        <p className="mt-2 text-sm text-zinc-600">
          {t('householdNeeds', {
            total: rounded(f.monthlyPlanMinor + f.savingsPlanMinor + setAside),
            spending: rounded(f.monthlyPlanMinor),
            savings: rounded(f.savingsPlanMinor),
            pot: rounded(setAside),
          })}
        </p>
      </Card>

      <Card>
        <table className="w-full text-sm" data-testid="forecast-months">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="font-normal">{t('month')}</th>
              <th className="text-right font-normal">{t('in')}</th>
              <th className="text-right font-normal">{t('out')}</th>
              <th className="text-right font-normal">{t('end')}</th>
            </tr>
          </thead>
          <tbody>
            {f.months.map((m) => (
              <tr key={`${m.period.year}-${m.period.month}`} className="border-t border-zinc-100">
                <td className="py-1">
                  {formatMonthShort(m.period, money.locale)} {m.period.year}
                  {m.estimate && <span className="text-zinc-500"> · {t('estimate')}</span>}
                </td>
                <td className="text-right tabular-nums">{rounded(m.inMinor)}</td>
                <td className="text-right tabular-nums">{rounded(m.outMinor)}</td>
                <td className={`text-right tabular-nums ${m.endMinor < 0 ? 'font-semibold text-red-700' : ''}`}>{rounded(m.endMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardTitle>{t('bills')}</CardTitle>
        <ul className="space-y-2 text-sm">
          {f.bills
            .filter((b) => b.lines.length > 0)
            .map((b) => (
              <li key={`${b.period.year}-${b.period.month}`}>
                <p className="font-medium text-zinc-600">{formatPeriod(b.period, money.locale)}</p>
                {b.lines.map((line) => (
                  <p key={`${line.yearLineId ?? line.name}`} className="flex justify-between">
                    <span>
                      {line.name} <span className="text-zinc-500">· {tStatus(line.status)}</span>
                    </span>
                    <span className="tabular-nums">{exact(line.remainingMinor)}</span>
                  </p>
                ))}
              </li>
            ))}
        </ul>
      </Card>

      {f.undated.map((u) => (
        <Card key={u.year}>
          <CardTitle>{t('undatedTitle', { year: u.year, count: u.count, amount: rounded(u.totalMinor) })}</CardTitle>
          <ul className="text-sm">
            {u.lines.map((line) => (
              <li key={line.yearLineId} className="flex justify-between">
                <span>{line.name}</span>
                <span className="tabular-nums">{exact(line.remainingMinor)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
