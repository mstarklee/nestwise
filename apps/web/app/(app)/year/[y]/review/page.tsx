import { YearParam } from '@nestwise/api-contract';
import { YearPlanNotFoundError } from '@nestwise/domain/year-plan';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMonthShort, minorToInput } from '@/client/format';
import { makeGetNextYearReviewUseCase } from '@/composition/year-plan';
import { PageLoading } from '@/components/page-loading';
import { DetailHeader } from '@/components/screen-header';
import { Card } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';
import { YearLineActions } from '../year-line-actions';
import { AmountEditor, LooksRight } from './review-actions';

type Params = Promise<{ y: string }>;

export default function NextYearReviewPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NextYearReview params={params} />
    </Suspense>
  );
}

/** The 1 December review of next year's bills: change an amount, give a month, then "Looks right". */
async function NextYearReview({ params }: { params: Params }) {
  const parsed = YearParam.safeParse((await params).y);
  if (!parsed.success) notFound();
  const year = parsed.data;
  const { actor, family } = await pageContext();
  const t = await getTranslations('nextYear');
  const tYear = await getTranslations('year');
  const money = moneyOf(family);
  let review;
  try {
    review = await makeGetNextYearReviewUseCase().execute({ actor, year });
  } catch (error) {
    if (!(error instanceof YearPlanNotFoundError)) throw error;
    return (
      <>
        <DetailHeader title={t('title', { year })} />
        <Card>{tYear('notYet', { year })}</Card>
      </>
    );
  }
  const isAdmin = actor.role === 'admin';
  const open = review.lines.filter((l) => l.state === 'open');

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader title={t('title', { year })} />
      <p className="text-[14px] text-muted">{review.confirmed ? t('confirmed') : t('explain')}</p>
      <Card>
        <ul className="divide-y divide-line">
          {open.map((line) => (
            <li key={line.id} className="space-y-2 py-3">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 break-words font-semibold">{line.name}</span>
                <span className="shrink-0 rounded-full bg-mist px-2.5 py-0.5 text-[13.5px] font-semibold text-peacock">
                  {line.dueMonth === null ? tYear('noMonth') : formatMonthShort({ year: line.dueYear, month: line.dueMonth }, money.locale)}
                </span>
              </div>
              {isAdmin ? (
                <>
                  <AmountEditor year={year} lineId={line.id} initial={minorToInput(line.plannedMinor, money.minorUnit)} minorUnit={money.minorUnit} />
                  <YearLineActions year={year} line={{ id: line.id, dueMonth: line.dueMonth, dueDay: line.dueDay, paid: line.status === 'paid' }} locale={money.locale} />
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      {isAdmin && !review.confirmed && <LooksRight year={year} />}
    </div>
  );
}
