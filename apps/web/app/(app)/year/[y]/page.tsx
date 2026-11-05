import { YearParam } from '@nestwise/api-contract';
import { YearPlanNotFoundError } from '@nestwise/domain/year-plan';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatMonthShort } from '@/client/format';
import { iconFor } from '@/client/group-icon';
import { makeGetYearPlanUseCase } from '@/composition/year-plan';
import { Icon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { DetailHeader } from '@/components/screen-header';
import { PageLoading } from '@/components/page-loading';
import { StatusChip } from '@/components/status-chip';
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
  const money = moneyOf(family);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);

  let view;
  try {
    view = await makeGetYearPlanUseCase().execute({ actor, year });
  } catch (error) {
    if (!(error instanceof YearPlanNotFoundError)) throw error;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <DetailHeader title={t('title', { year })} />
        <Card>{t('notYet', { year })}</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader
        title={t('title', { year })}
        action={
          <>
            <NavLink href={`/year/${year - 1}`} direction="back" aria-label={t('previous')} className="flex size-11 items-center justify-center rounded-full bg-white/15">
              <Icon name="prev" className="size-6" />
            </NavLink>
            <NavLink href={`/year/${year + 1}`} direction="forward" aria-label={t('next')} className="flex size-11 items-center justify-center rounded-full bg-white/15">
              <Icon name="next" className="size-6" />
            </NavLink>
          </>
        }
      />
      <section className="rounded-card bg-white p-4 shadow-card">
        <p className="money text-[19px] font-bold">{t('total', { amount: exact(view.totalMinor) })}</p>
        <p className="text-[13.5px] text-muted">{t('undatedRemaining', { amount: exact(view.undatedRemainingMinor) })}</p>
      </section>
      <section className="rounded-card bg-white p-4 shadow-card">
        <ul className="divide-y divide-line">
          {view.lines.map((line) => (
            <li key={line.id} className="py-3" data-testid={`year-line-${line.name}`}>
              <div className="flex items-center gap-2">
                <Icon name={iconFor(line.name)} className="size-5 shrink-0 text-peacock" />
                <span className="min-w-0 flex-1 break-words font-semibold">{line.name}</span>
                <span className="money shrink-0 font-semibold">{exact(line.plannedMinor)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pl-7 text-[13.5px] text-muted">
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-mist px-2.5 py-0.5 font-semibold text-peacock">
                    {line.dueMonth === null ? t('noMonth') : formatMonthShort({ year: line.dueYear, month: line.dueMonth }, money.locale)}
                  </span>
                  <StatusChip status={line.status} />
                </span>
                <span className="money">{t('left', { amount: exact(line.remainingMinor) })}</span>
              </div>
              {actor.role === 'admin' && line.state === 'open' && (
                <YearLineActions year={year} line={{ id: line.id, dueMonth: line.dueMonth, dueDay: line.dueDay, paid: line.status === 'paid' }} locale={money.locale} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
