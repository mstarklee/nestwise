import { MonthParam } from '@nestwise/api-contract';
import { addMonths } from '@nestwise/domain/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatPeriod, toYm } from '@/client/format';
import { makeGetMonthSummaryUseCase } from '@/composition/month-budget';
import { PageLoading } from '@/components/page-loading';
import { Card, CardTitle } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';
import { PlannedEditor } from './planned-editor';

type Params = Promise<{ ym: string }>;

export default function MonthPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Month params={params} />
    </Suspense>
  );
}

async function Month({ params }: { params: Params }) {
  const parsed = MonthParam.safeParse((await params).ym);
  if (!parsed.success) notFound();
  const period = parsed.data;
  const { actor, family } = await pageContext();
  const t = await getTranslations('month');
  const summary = await makeGetMonthSummaryUseCase().execute({ actor, period });
  const money = moneyOf(family);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
  const canEdit = actor.role !== 'viewer';
  const ym = toYm(period);

  return (
    <div className="space-y-4 py-4">
      <header className="flex items-center justify-between">
        <Link href={`/month/${toYm(addMonths(period, -1))}`} className="text-green-900 underline" aria-label={t('previous')}>
          ‹
        </Link>
        <h1 className="text-xl font-semibold">{formatPeriod(period, money.locale)}</h1>
        <Link href={`/month/${toYm(addMonths(period, 1))}`} className="text-green-900 underline" aria-label={t('next')}>
          ›
        </Link>
      </header>

      <Card>
        <p className="text-sm text-zinc-600">{t('totals')}</p>
        <p className="tabular-nums">
          {t('spentOfPlanned', { actual: exact(summary.totals.actualMinor), planned: exact(summary.totals.plannedMinor) })}
        </p>
      </Card>

      {summary.groups.map((group) => (
        <Card key={group.groupName}>
          <CardTitle className="flex justify-between">
            <span>{group.groupName}</span>
            <span className={`tabular-nums ${group.varianceMinor > 0 ? 'text-red-700' : ''}`}>
              {exact(group.actualMinor)} / {exact(group.plannedMinor)}
            </span>
          </CardTitle>
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="font-normal">{t('item')}</th>
                <th className="text-right font-normal">{t('planned')}</th>
                <th className="text-right font-normal">{t('actual')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.lines
                .filter((l) => l.groupName === group.groupName)
                .map((line) => (
                  <tr key={line.itemId} data-testid={`line-${line.name}`} className="border-t border-zinc-100">
                    <td className="py-1">{line.name}</td>
                    <td className="text-right">
                      {canEdit ? <PlannedEditor ym={ym} itemId={line.itemId} plannedMinor={line.plannedMinor} money={money} /> : exact(line.plannedMinor)}
                    </td>
                    <td className={`text-right tabular-nums ${line.varianceMinor > 0 ? 'text-red-700' : ''}`}>{exact(line.actualMinor)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      ))}

      <Card>
        <CardTitle>{t('savings')}</CardTitle>
        <ul className="text-sm">
          {summary.savings.lines.map((s) => (
            <li key={s.itemId} className="flex justify-between">
              <span>{s.name}</span>
              <span className="tabular-nums">{exact(s.plannedMinor)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
