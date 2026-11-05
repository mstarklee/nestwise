import { CaptureBatchNotFoundError } from '@nestwise/domain/capture';
import { YearPlanNotFoundError } from '@nestwise/domain/year-plan';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { makeGetCaptureBatchUseCase } from '@/composition/capture';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { makeGetPotBalanceUseCase } from '@/composition/pot';
import { makeGetYearPlanUseCase } from '@/composition/year-plan';
import { DetailHeader } from '@/components/screen-header';
import { PageLoading } from '@/components/page-loading';
import { VoiceReview } from '@/components/voice-review';
import { moneyOf, pageContext } from '@/http/page-session';

export default function CaptureReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Review params={params} />
    </Suspense>
  );
}

/** Check what was heard, then add it (design §8). Nothing on this screen has touched a total yet. */
async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, family, current } = await pageContext();
  const t = await getTranslations('voice');
  const money = moneyOf(family);

  let batch;
  try {
    batch = await makeGetCaptureBatchUseCase().execute({ actor, batchId: id });
  } catch (error) {
    if (error instanceof CaptureBatchNotFoundError) notFound();
    throw error;
  }

  const templates = await makeGetTemplatesUseCase().execute({ actor });
  const items = templates.monthly.map((line) => ({ id: line.itemId, name: line.name, group: line.groupName }));

  const year = await makeGetYearPlanUseCase()
    .execute({ actor, year: current.year })
    .catch((error: unknown) => {
      if (error instanceof YearPlanNotFoundError) return undefined;
      throw error;
    });
  const bills = (year?.lines ?? [])
    // Still owed only: a bill whose payments already cover it is not offered (design §6), matching the parse context.
    .filter((line) => line.state === 'open' && line.remainingMinor > 0)
    .map((line) => ({ id: line.id, name: line.name, plannedMinor: line.plannedMinor, remainingMinor: line.remainingMinor }));

  const pot = await makeGetPotBalanceUseCase().execute({ actor });

  return (
    <>
      <DetailHeader title={t('reviewTitle', { count: batch.entries.length })} />
      <div className="mx-auto max-w-xl space-y-4">
      <p className="text-[14px] text-muted">{t('reviewExplain')}</p>
      <VoiceReview
        batchId={batch.id}
        transcript={batch.transcript}
        mine={batch.mine}
        rows={batch.entries.map((entry) => ({
          id: entry.id,
          amountMinor: entry.amountMinor,
          itemId: entry.itemId,
          yearLineId: entry.yearLineId,
          kind: entry.kind,
          txnDate: entry.txnDate,
          merchant: entry.merchant,
          note: entry.note,
          heard: entry.heard,
          needsAttention: entry.needsAttention,
        }))}
        items={items}
        bills={bills}
        potBalanceMinor={pot.balanceMinor}
        currency={money.currency}
        minorUnit={money.minorUnit}
        locale={money.locale}
      />
      </div>
    </>
  );
}
