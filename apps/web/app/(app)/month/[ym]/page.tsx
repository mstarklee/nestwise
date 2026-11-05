import { MonthParam } from '@nestwise/api-contract';
import { addMonths } from '@nestwise/domain/shared';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatPeriod, toYm } from '@/client/format';
import { iconFor } from '@/client/group-icon';
import { ringOf } from '@/client/ring';
import { makeGetMonthSummaryUseCase } from '@/composition/month-budget';
import { Icon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { mTag } from '@/components/num';
import { PageLoading } from '@/components/page-loading';
import { TabHeader } from '@/components/screen-header';
import { RingDial } from '@/components/spending-rings';
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

const ARROW = 'flex size-11 items-center justify-center rounded-full bg-white/15 transition-transform active:scale-[.97] motion-reduce:transform-none';

/** The Budgets tab root: this month (or any month) as a spent-of-planned bar, then one card per group with its ring. */
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
  const total = summary.totals;
  const share = total.plannedMinor > 0 ? Math.min(100, Math.round((total.actualMinor * 100) / total.plannedMinor)) : total.actualMinor > 0 ? 100 : 0;
  const over = total.actualMinor > total.plannedMinor;

  return (
    <>
      <TabHeader
        title={formatPeriod(period, money.locale)}
        action={
          <>
            <NavLink href={`/month/${toYm(addMonths(period, -1))}`} direction="tab" aria-label={t('previous')} className={ARROW}>
              <Icon name="prev" className="size-6" />
            </NavLink>
            <NavLink href={`/month/${toYm(addMonths(period, 1))}`} direction="tab" aria-label={t('next')} className={ARROW}>
              <Icon name="next" className="size-6" />
            </NavLink>
          </>
        }
      >
        <div className="flex items-end justify-between gap-3">
          <p className="min-w-0 text-[14px] opacity-90">
            {t.rich('spentOfPlanned', { m: mTag, actual: (exact(total.actualMinor)), planned: (exact(total.plannedMinor)) })}
          </p>
          <NavLink href="/templates" direction="forward" className="flex min-h-11 shrink-0 items-center rounded-full bg-gold px-4 text-[13.5px] font-bold text-ink">
            {t('templates')}
          </NavLink>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
          <div className={`h-full rounded-full ${over ? 'bg-rani' : 'bg-gold'}`} style={{ width: `${share}%` }} />
        </div>
      </TabHeader>

      <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
        {summary.groups.map((group) => {
          const ring = ringOf(group.actualMinor, group.plannedMinor, family.alertThresholds);
          return (
            <section key={group.groupName} className="rounded-card bg-white p-4 shadow-card">
              <div className="mb-2 flex items-center gap-3">
                <RingDial ring={ring} size={56} />
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-[19px] font-bold leading-tight">{group.groupName}</h2>
                  <p className={`money text-[13.5px] ${ring.tone === 'over' ? 'font-semibold text-rani' : 'text-muted'}`}>
                    {exact(group.actualMinor)} / {exact(group.plannedMinor)}
                    {ring.tone === 'over' ? ` ${t('over', { amount: exact(ring.overMinor) })}` : ''}
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {summary.lines
                  .filter((l) => l.groupName === group.groupName)
                  .map((line) => (
                    <li key={line.itemId} data-testid={`line-${line.name}`} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon name={iconFor(line.name)} className="size-[18px] shrink-0 text-peacock" />
                        <span className="min-w-0 flex-1 break-words font-semibold">{line.name}</span>
                        <span className={`money shrink-0 font-semibold ${line.varianceMinor > 0 ? 'text-rani' : ''}`}>{exact(line.actualMinor)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 pl-[26px] text-[13.5px] text-muted">
                        <span className={line.varianceMinor > 0 ? 'font-semibold text-rani' : ''}>
                          {line.varianceMinor > 0 ? t('over', { amount: exact(line.varianceMinor) }) : ''}
                        </span>
                        <span className="money flex items-center gap-1.5">
                          {t('plan')}
                          {canEdit ? <PlannedEditor ym={ym} itemId={line.itemId} plannedMinor={line.plannedMinor} money={money} /> : exact(line.plannedMinor)}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}

        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 text-[19px] font-bold">{t('savings')}</h2>
          <ul className="divide-y divide-line">
            {summary.savings.lines.map((s) => (
              <li key={s.itemId} className="flex items-center gap-2 py-2.5">
                <Icon name="savings" className="size-[18px] shrink-0 text-peacock" />
                <span className="min-w-0 flex-1 break-words font-semibold">{s.name}</span>
                <span className="money shrink-0">{exact(s.plannedMinor)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
