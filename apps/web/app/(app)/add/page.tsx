import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { YearPlanNotFoundError } from '@nestwise/domain/year-plan';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { makeGetYearPlanUseCase } from '@/composition/year-plan';
import { PageLoading } from '@/components/page-loading';
import { QuickActions } from '@/components/quick-actions';
import { TabHeader } from '@/components/screen-header';
import { moneyOf, pageContext } from '@/http/page-session';
import { AddExpenseForm } from './add-expense-form';
import { OutboxFailures } from './outbox-failures';

export default function AddPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Add />
    </Suspense>
  );
}

async function Add() {
  const { actor, family, today } = await pageContext();
  const t = await getTranslations('add');
  const templates = await makeGetTemplatesUseCase().execute({ actor });
  const groups = (kind: 'monthly' | 'yearly') => {
    const byGroup = new Map<string, { label: string; items: { id: string; name: string }[] }>();
    for (const e of templates[kind]) {
      const group = byGroup.get(e.groupId) ?? { label: e.groupName, items: [] };
      group.items.push({ id: e.itemId, name: e.name });
      byGroup.set(e.groupId, group);
    }
    return [...byGroup.values()];
  };
  if (actor.role === 'viewer')
    return (
      <>
        <TabHeader title={t('title')} border={false} />
        <p className="rounded-card bg-white p-4 shadow-card">{t('viewerCannot')}</p>
      </>
    );
  // Last year's bills still open (carried or not yet answered) are paid against their own year's plan (TRD §5.7).
  const lastYear = Number(today.slice(0, 4)) - 1;
  let stillOpen: { id: string; name: string }[] = [];
  try {
    const view = await makeGetYearPlanUseCase().execute({ actor, year: lastYear });
    stillOpen = view.lines.filter((l) => l.state === 'open' && l.remainingMinor > 0).map((l) => ({ id: `${l.itemId}@${lastYear}`, name: `${l.name} (${lastYear})` }));
  } catch (error) {
    if (!(error instanceof YearPlanNotFoundError)) throw error;
  }
  const yearly = stillOpen.length > 0 ? [...groups('yearly'), { label: t('lastYearGroup', { year: lastYear }), items: stillOpen }] : groups('yearly');
  const money = moneyOf(family);
  return (
    <>
      <TabHeader title={t('title')} border={false} />
      <div className="mx-auto max-w-xl space-y-4">
        <QuickActions withType={false} />
        <AddExpenseForm today={today} money={money} monthly={groups('monthly')} yearly={yearly} userId={actor.userId} />
        <OutboxFailures money={money} userId={actor.userId} />
      </div>
    </>
  );
}
