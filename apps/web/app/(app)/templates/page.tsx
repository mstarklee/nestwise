import type { TemplateEntry } from '@nestwise/domain/plan';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatMoney, formatPeriod, toYm } from '@/client/format';
import { makePreviewFutureMonthsUseCase } from '@/composition/month-budget';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { PageLoading } from '@/components/page-loading';
import { Card, CardTitle } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';
import { AddItemForm, TemplateItemEditor } from './template-editors';

export default function TemplatesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Templates />
    </Suspense>
  );
}

/** The three templates. Edits change future months and years only, never ones already created (PRD §6.2). */
async function Templates() {
  const { actor, family } = await pageContext();
  const t = await getTranslations('templates');
  const [templates, future] = await Promise.all([
    makeGetTemplatesUseCase().execute({ actor }),
    actor.role === 'admin' ? makePreviewFutureMonthsUseCase().execute({ actor }) : { months: [] },
  ]);
  const money = moneyOf(family);
  const canEdit = actor.role === 'admin';
  const sections = [
    { kind: 'monthly', title: t('monthly'), entries: templates.monthly, total: templates.totals.monthly },
    { kind: 'savings', title: t('savings'), entries: templates.savings, total: templates.totals.savings },
    { kind: 'yearly', title: t('yearly'), entries: templates.yearly, total: templates.totals.yearly },
  ] as const;

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="text-sm text-zinc-600">{t('intro')}</p>
      {sections.map((section) => (
        <Card key={section.kind}>
          <CardTitle className="flex justify-between">
            <span>{section.title}</span>
            <span className="tabular-nums">{formatMoney(section.total, money.currency, money.minorUnit, money.locale)}</span>
          </CardTitle>
          {groupsOf(section.entries).map((group) => (
            <div key={group.groupId} className="mt-3">
              <h3 className="text-sm font-medium text-zinc-600">{group.groupName}</h3>
              <ul className="divide-y divide-zinc-100">
                {group.entries.map((entry) => (
                  <li key={entry.itemId} className="py-2">
                    <TemplateItemEditor
                      entry={{ itemId: entry.itemId, name: entry.name, amountMinor: entry.amountMinor, dueMonth: entry.dueMonth }}
                      yearly={section.kind === 'yearly'}
                      canEdit={canEdit}
                      money={money}
                      futureMonths={section.kind === 'yearly' ? [] : future.months.map((m) => ({ ym: toYm(m), label: formatPeriod(m, money.locale) }))}
                    />
                  </li>
                ))}
              </ul>
              {canEdit && <AddItemForm groupId={group.groupId} money={money} />}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

function groupsOf(entries: readonly TemplateEntry[]) {
  const groups = new Map<string, { groupId: string; groupName: string; entries: TemplateEntry[] }>();
  for (const entry of entries) {
    const group = groups.get(entry.groupId) ?? { groupId: entry.groupId, groupName: entry.groupName, entries: [] };
    group.entries.push(entry);
    groups.set(entry.groupId, group);
  }
  return [...groups.values()];
}
