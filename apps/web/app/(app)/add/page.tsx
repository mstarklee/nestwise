import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { PageLoading } from '@/components/page-loading';
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
  if (actor.role === 'viewer') return <p className="py-4">{t('viewerCannot')}</p>;
  const money = moneyOf(family);
  return (
    <>
      <AddExpenseForm today={today} money={money} monthly={groups('monthly')} yearly={groups('yearly')} userId={actor.userId} />
      <OutboxFailures money={money} />
    </>
  );
}
