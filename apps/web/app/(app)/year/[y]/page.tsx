import { YearParam } from '@nestwise/api-contract';
import { YearPlanNotFoundError } from '@nestwise/domain/year-plan';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatMonthShort } from '@/client/format';
import { makeGetYearPlanUseCase } from '@/composition/year-plan';
import { PageLoading } from '@/components/page-loading';
import { Card } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';
import { YearLineActions } from './year-line-actions';

type Params = Promise<{ y: string }>;

export default function YearPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Year params={params} />
    </Suspense>
  );
}

async function Year({ params }: { params: Params }) {
  const parsed = YearParam.safeParse((await params).y);
  if (!parsed.success) notFound();
  const year = parsed.data;
  const { actor, family } = await pageContext();
  const t = await getTranslations('year');
  const tStatus = await getTranslations('status');
  const money = moneyOf(family);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);

  let view;
  try {
    view = await makeGetYearPlanUseCase().execute({ actor, year });
  } catch (error) {
    if (!(error instanceof YearPlanNotFoundError)) throw error;
    return (
      <div className="space-y-4 py-4">
        <h1 className="text-xl font-semibold">{t('title', { year })}</h1>
        <Card>{t('notYet', { year })}</Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <header className="flex items-center justify-between">
        <Link href={`/year/${year - 1}`} className="text-green-900 underline" aria-label={t('previous')}>
          ‹
        </Link>
        <h1 className="text-xl font-semibold">{t('title', { year })}</h1>
        <Link href={`/year/${year + 1}`} className="text-green-900 underline" aria-label={t('next')}>
          ›
        </Link>
      </header>
      <Card>
        <p className="tabular-nums">{t('total', { amount: exact(view.totalMinor) })}</p>
        <p className="text-sm text-zinc-600">{t('undatedRemaining', { amount: exact(view.undatedRemainingMinor) })}</p>
      </Card>
      <Card>
        <ul className="divide-y divide-zinc-100">
          {view.lines.map((line) => (
            <li key={line.id} className="py-2" data-testid={`year-line-${line.name}`}>
              <div className="flex justify-between gap-2">
                <span className="font-medium">{line.name}</span>
                <span className="tabular-nums">{exact(line.plannedMinor)}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-600">
                <span>
                  {line.dueMonth === null ? t('noMonth') : formatMonthShort({ year: line.dueYear, month: line.dueMonth }, money.locale)}
                  {' · '}
                  {tStatus(line.status)}
                </span>
                <span className="tabular-nums">{t('left', { amount: exact(line.remainingMinor) })}</span>
              </div>
              {actor.role === 'admin' && line.state === 'open' && (
                <YearLineActions year={year} line={{ id: line.id, dueMonth: line.dueMonth, dueDay: line.dueDay, paid: line.status === 'paid' }} />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
