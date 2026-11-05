import { YearParam } from '@nestwise/api-contract';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney } from '@/client/format';
import { makeGetYearEndReviewUseCase } from '@/composition/year-plan';
import { PageLoading } from '@/components/page-loading';
import { DetailHeader } from '@/components/screen-header';
import { Card } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';
import { YearEndActions } from './year-end-actions';

type Params = Promise<{ y: string }>;

export default function YearEndPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <YearEnd params={params} />
    </Suspense>
  );
}

/** Last year's bills still open (PRD §5.3): done, still to pay this year, or drop. Nothing disappears on its own. */
async function YearEnd({ params }: { params: Params }) {
  const parsed = YearParam.safeParse((await params).y);
  if (!parsed.success) notFound();
  const year = parsed.data;
  const { actor, family } = await pageContext();
  const t = await getTranslations('yearEnd');
  const money = moneyOf(family);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
  const review = await makeGetYearEndReviewUseCase().execute({ actor, year });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader title={t('title', { year })} />
      <p className="text-[14px] text-muted">{t('explain', { year, next: year + 1 })}</p>
      {review.lines.length === 0 && <Card>{t('allAnswered', { year })}</Card>}
      {review.lines.map((line) => (
        <Card key={line.id} className="space-y-1" data-testid={`year-end-${line.name}`}>
          <p className="font-semibold">{line.name}</p>
          <p className="money text-[13.5px] text-muted">
            {line.paidMinor > 0 ? t('partPaid', { paid: exact(line.paidMinor), planned: exact(line.plannedMinor) }) : t('unpaid', { planned: exact(line.plannedMinor) })}
          </p>
          {actor.role === 'admin' && <YearEndActions year={year} lineId={line.id} locale={money.locale} />}
        </Card>
      ))}
    </div>
  );
}
